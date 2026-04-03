package controllers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"platform/internal/database"
	"platform/internal/models"
	"platform/internal/utils"

	"github.com/go-chi/chi/v5"
)

// erpInternalURL devuelve la URL base del ERP backend interno (siempre termina en /internal)
func erpInternalURL() string {
	url := os.Getenv("ERP_INTERNAL_URL")
	if url == "" {
		url = "http://localhost:8080"
	}
	url = strings.TrimRight(url, "/")
	if !strings.HasSuffix(url, "/internal") {
		url += "/internal"
	}
	return url
}

// erpInternalKey devuelve la API key interna compartida con el ERP
func erpInternalKey() string {
	key := os.Getenv("INTERNAL_API_KEY")
	if key == "" {
		key = "innofactu-internal-2026"
	}
	return key
}

// provisionInERPResult holds the parsed response from ERP provisioning
type provisionInERPResult struct {
	AdminPassword string
}

// provisionInERP llama al ERP backend para crear el schema y tenant allí
func provisionInERP(tenant models.Tenant, planCode string, adminPassword string) (*provisionInERPResult, error) {
	payload := map[string]interface{}{
		"company_name":   tenant.CompanyName,
		"slug":           tenant.Slug,
		"schema":         "t_" + strings.ReplaceAll(tenant.Slug, "-", "_"),
		"rut":            tenant.RUT,
		"admin_email":    tenant.AdminEmail,
		"admin_name":     tenant.AdminName,
		"admin_password": adminPassword,
		"plan_code":      planCode,
		"status":         "active",
		"region":         tenant.Region,
		"timezone":       tenant.Timezone,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, erpInternalURL()+"/provision", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Key", erpInternalKey())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling ERP provision: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var errBody map[string]string
		json.Unmarshal(respBody, &errBody)
		return nil, fmt.Errorf("ERP provision error %d: %s", resp.StatusCode, errBody["error"])
	}

	// Parse response to capture admin_password if ERP generated it
	var parsed map[string]interface{}
	json.Unmarshal(respBody, &parsed)

	result := &provisionInERPResult{}
	if pw, ok := parsed["admin_password"].(string); ok && pw != "" {
		result.AdminPassword = pw
	}
	return result, nil
}

type TenantStats struct {
	Total     int64 `json:"total"`
	Trial     int64 `json:"trial"`
	Active    int64 `json:"active"`
	Suspended int64 `json:"suspended"`
	Cancelled int64 `json:"cancelled"`
}

func GetTenants(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	status := r.URL.Query().Get("status")
	planID := r.URL.Query().Get("plan_id")

	query := database.DB.Preload("Plan").Order("created_at DESC")

	if q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(company_name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(admin_email) LIKE ?", like, like, like)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if planID != "" {
		query = query.Where("plan_id = ?", planID)
	}

	var tenants []models.Tenant
	query.Find(&tenants)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenants)
}

func GetTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var tenant models.Tenant
	if err := database.DB.Preload("Plan").First(&tenant, "id = ?", id).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Empresa no encontrada"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenant)
}

func CreateTenant(w http.ResponseWriter, r *http.Request) {
	var body struct {
		models.Tenant
		AdminPassword string `json:"admin_password"`
		PlanCode      string `json:"plan_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}
	tenant := body.Tenant

	// Generar slug si no viene
	if tenant.Slug == "" && tenant.CompanyName != "" {
		tenant.Slug = slugifyTenant(tenant.CompanyName)
		// Asegurar unicidad
		var count int64
		database.DB.Model(&models.Tenant{}).Where("slug LIKE ?", tenant.Slug+"%").Count(&count)
		if count > 0 {
			tenant.Slug = fmt.Sprintf("%s%d", tenant.Slug, count+1)
		}
	}

	if tenant.Status == "" {
		tenant.Status = "active"
	}
	if tenant.Region == "" {
		tenant.Region = "uy"
	}
	if tenant.Timezone == "" {
		tenant.Timezone = "America/Montevideo"
	}
	if tenant.DBSchema == "" {
		tenant.DBSchema = "t_" + strings.ReplaceAll(tenant.Slug, "-", "_")
	}

	// Obtener plan_code si no viene, buscarlo por plan_id
	planCode := body.PlanCode
	if planCode == "" && tenant.PlanID > 0 {
		var plan models.Plan
		if err := database.DB.First(&plan, tenant.PlanID).Error; err == nil {
			planCode = plan.Code
		}
	}

	if err := database.DB.Create(&tenant).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error creando empresa"})
		return
	}

	// Generar contraseña segura si no viene en el body
	adminPwd := body.AdminPassword
	generatedPassword := ""
	if adminPwd == "" {
		generatedPassword = utils.GenerateSecurePassword(16)
		adminPwd = generatedPassword
	}

	// Provisionar en el ERP (schema PostgreSQL + tenant record allá)
	finalPassword := adminPwd
	erpResult, err := provisionInERP(tenant, planCode, adminPwd)
	if err != nil {
		log.Printf("Warning: ERP provisioning failed for %s: %v", tenant.Slug, err)
		// No bloqueamos — el admin puede reprovisionarlo
	} else {
		log.Printf("Tenant %s provisioned in ERP successfully", tenant.Slug)
		// If ERP generated a password, use that one
		if erpResult != nil && erpResult.AdminPassword != "" {
			finalPassword = erpResult.AdminPassword
		}
	}

	database.DB.Preload("Plan").First(&tenant, "id = ?", tenant.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant": tenant,
		"admin_credentials": map[string]interface{}{
			"email":    tenant.AdminEmail,
			"password": finalPassword,
			"note":     "Esta contraseña solo se muestra una vez.",
		},
	})
}

func slugifyTenant(s string) string {
	s = strings.ToLower(s)
	var result strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			result.WriteRune(r)
		} else if r == ' ' || r == '-' || r == '_' {
			result.WriteRune('-')
		}
	}
	return strings.Trim(result.String(), "-")
}

func UpdateTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var tenant models.Tenant
	if err := database.DB.First(&tenant, "id = ?", id).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Empresa no encontrada"})
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&tenant); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	tenant.ID = id
	if err := database.DB.Save(&tenant).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error actualizando empresa"})
		return
	}

	database.DB.Preload("Plan").First(&tenant, "id = ?", tenant.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenant)
}

func SuspendTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result := database.DB.Model(&models.Tenant{}).Where("id = ?", id).Update("status", "suspended")
	if result.RowsAffected == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Empresa no encontrada"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Empresa suspendida correctamente"})
}

func ReactivateTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result := database.DB.Model(&models.Tenant{}).Where("id = ?", id).Update("status", "active")
	if result.RowsAffected == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Empresa no encontrada"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Empresa reactivada correctamente"})
}

func GetTenantStats(w http.ResponseWriter, r *http.Request) {
	var stats TenantStats

	database.DB.Model(&models.Tenant{}).Count(&stats.Total)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "trial").Count(&stats.Trial)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "active").Count(&stats.Active)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "suspended").Count(&stats.Suspended)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "cancelled").Count(&stats.Cancelled)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ResetAdminPassword — POST /api/tenants/{id}/reset-admin-password
// Generates a new secure password and resets it via ERP internal endpoint
func ResetAdminPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var tenant models.Tenant
	if err := database.DB.First(&tenant, "id = ?", id).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Empresa no encontrada"})
		return
	}

	if tenant.AdminEmail == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "El tenant no tiene email de administrador configurado"})
		return
	}

	schema := tenant.DBSchema
	if schema == "" {
		schema = "t_" + strings.ReplaceAll(tenant.Slug, "-", "_")
	}

	newPassword := utils.GenerateSecurePassword(16)

	// Call ERP internal endpoint to reset
	payload := map[string]interface{}{
		"schema":       schema,
		"email":        tenant.AdminEmail,
		"new_password": newPassword,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, erpInternalURL()+"/reset-user-password", bytes.NewReader(body))
	if err != nil {
		http.Error(w, "Error building request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Key", erpInternalKey())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "Error contacting ERP", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody map[string]string
		json.NewDecoder(resp.Body).Decode(&errBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error reseteando contraseña: " + errBody["error"]})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"email":    tenant.AdminEmail,
		"password": newPassword,
		"note":     "Esta contraseña solo se muestra una vez.",
	})
}

// ── Certificado DGI (proxies al ERP interno) ─────────────────────────────────

// GetTenantCert devuelve el estado del cert de un tenant vía ERP interno.
func GetTenantCert(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "id")
	var tenant models.Tenant
	if err := database.DB.Where("id = ?", tenantID).First(&tenant).Error; err != nil {
		http.Error(w, "tenant no encontrado", http.StatusNotFound)
		return
	}
	schema := "t_" + strings.ReplaceAll(tenant.Slug, "-", "_")

	req, _ := http.NewRequest("GET", erpInternalURL()+"/cert/status?schema="+schema, nil)
	req.Header.Set("X-Internal-Key", erpInternalKey())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "error al contactar ERP: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// UploadTenantCert permite al platform admin subir un cert para cualquier tenant.
// Multipart: campo "cert" (archivo .pfx) + campo "password" + campo "notes"
func UploadTenantCert(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "id")
	var tenant models.Tenant
	if err := database.DB.Where("id = ?", tenantID).First(&tenant).Error; err != nil {
		http.Error(w, "tenant no encontrado", http.StatusNotFound)
		return
	}
	schema := "t_" + strings.ReplaceAll(tenant.Slug, "-", "_")

	if err := r.ParseMultipartForm(2 << 20); err != nil {
		http.Error(w, "archivo demasiado grande (máx 2MB)", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("cert")
	if err != nil {
		http.Error(w, "campo 'cert' requerido", http.StatusBadRequest)
		return
	}
	defer file.Close()
	pfxBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "error al leer el archivo", http.StatusInternalServerError)
		return
	}

	password := r.FormValue("password")
	notes := r.FormValue("notes")

	// Determinar quién sube (email del admin de platform desde contexto)
	uploadedBy := "platform-admin"
	if email, ok := r.Context().Value(contextKey("user_email")).(string); ok && email != "" {
		uploadedBy = email
	}

	body := map[string]string{
		"schema":        schema,
		"cert_b64_raw":  base64.StdEncoding.EncodeToString(pfxBytes),
		"cert_password": password,
		"uploaded_by":   uploadedBy,
		"notes":         notes,
	}
	bodyJSON, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", erpInternalURL()+"/cert", bytes.NewReader(bodyJSON))
	req.Header.Set("X-Internal-Key", erpInternalKey())
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "error al contactar ERP: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// GetTenantCertHistory devuelve el historial de certs de un tenant.
func GetTenantCertHistory(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "id")
	var tenant models.Tenant
	if err := database.DB.Where("id = ?", tenantID).First(&tenant).Error; err != nil {
		http.Error(w, "tenant no encontrado", http.StatusNotFound)
		return
	}
	schema := "t_" + strings.ReplaceAll(tenant.Slug, "-", "_")

	req, _ := http.NewRequest("GET", erpInternalURL()+"/cert/history?schema="+schema, nil)
	req.Header.Set("X-Internal-Key", erpInternalKey())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "error al contactar ERP: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}


func TenantRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(AuthRequired)
	r.Get("/", GetTenants)
	r.Post("/", CreateTenant)
	r.Get("/stats", GetTenantStats)
	r.Get("/{id}", GetTenant)
	r.Put("/{id}", UpdateTenant)
	r.Post("/{id}/suspend", SuspendTenant)
	r.Post("/{id}/reactivate", ReactivateTenant)
	r.Post("/{id}/reset-admin-password", ResetAdminPassword)
	// Certificados DGI
	r.Get("/{id}/cert", GetTenantCert)
	r.Post("/{id}/cert", UploadTenantCert)
	r.Get("/{id}/cert/history", GetTenantCertHistory)
	return r
}
