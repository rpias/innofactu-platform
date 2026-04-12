package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"platform/internal/database"
	"platform/internal/models"
)

// ── Menu Items (catálogo maestro) ─────────────────────────────────────────────

// ListMenuItems — GET /api/menu-items?app=erp
func ListMenuItems(w http.ResponseWriter, r *http.Request) {
	appFilter := r.URL.Query().Get("app")
	var items []models.MenuItem
	q := database.DB.Order("app_code, sort_order")
	if appFilter != "" {
		q = q.Where("app_code = ?", appFilter)
	}
	q.Find(&items)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// CreateMenuItem — POST /api/menu-items
func CreateMenuItem(w http.ResponseWriter, r *http.Request) {
	var item models.MenuItem
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := database.DB.Create(&item).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// UpdateMenuItem — PUT /api/menu-items/:id
func UpdateMenuItem(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var item models.MenuItem
	if err := database.DB.First(&item, id).Error; err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	item.ID = uint(id)
	database.DB.Save(&item)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// DeleteMenuItem — DELETE /api/menu-items/:id (soft disable)
func DeleteMenuItem(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	database.DB.Model(&models.MenuItem{}).Where("id = ?", id).Update("is_active", false)
	w.WriteHeader(http.StatusNoContent)
}

// ── Plan Menus ────────────────────────────────────────────────────────────────

// GetPlanMenu — GET /api/plan-menus/:plan_code
// Devuelve todos los ítems con su visibilidad para el plan.
func GetPlanMenu(w http.ResponseWriter, r *http.Request) {
	planCode := chi.URLParam(r, "plan_code")
	appFilter := r.URL.Query().Get("app")

	var items []models.MenuItem
	q := database.DB.Where("is_active = true").Order("sort_order")
	if appFilter != "" {
		q = q.Where("app_code = ?", appFilter)
	}
	q.Find(&items)

	var planEntries []models.PlanMenuItem
	database.DB.Where("plan_code = ?", planCode).Find(&planEntries)
	planMap := make(map[uint]bool)
	for _, pe := range planEntries {
		planMap[pe.MenuItemID] = pe.IsVisible
	}

	type itemWithVisibility struct {
		models.MenuItem
		IsVisibleInPlan bool `json:"is_visible_in_plan"`
	}
	var result []itemWithVisibility
	for _, item := range items {
		vis, exists := planMap[item.ID]
		if !exists {
			vis = true // sin entrada = visible por defecto
		}
		result = append(result, itemWithVisibility{MenuItem: item, IsVisibleInPlan: vis})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// SetPlanMenuItem — PUT /api/plan-menus/:plan_code/:item_id
func SetPlanMenuItem(w http.ResponseWriter, r *http.Request) {
	planCode := chi.URLParam(r, "plan_code")
	itemID, _ := strconv.Atoi(chi.URLParam(r, "item_id"))

	var body struct {
		IsVisible bool `json:"is_visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entry := models.PlanMenuItem{
		PlanCode:   planCode,
		MenuItemID: uint(itemID),
		IsVisible:  body.IsVisible,
	}
	database.DB.Save(&entry)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

// ── Tenant Menu Overrides ─────────────────────────────────────────────────────

// GetTenantMenu — GET /api/tenant-menus/:tenant_id
// Devuelve los overrides del tenant con el estado resuelto (plan base + override).
func GetTenantMenu(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenant_id")
	appFilter := r.URL.Query().Get("app")

	// Obtener plan del tenant
	var tenant models.Tenant
	if err := database.DB.Preload("Plan").First(&tenant, "id = ?", tenantID).Error; err != nil {
		http.Error(w, "tenant not found", http.StatusNotFound)
		return
	}

	var items []models.MenuItem
	q := database.DB.Where("is_active = true").Order("sort_order")
	if appFilter != "" {
		q = q.Where("app_code = ?", appFilter)
	}
	q.Find(&items)

	var planEntries []models.PlanMenuItem
	database.DB.Where("plan_code = ?", tenant.Plan.Code).Find(&planEntries)
	planMap := make(map[uint]bool)
	for _, pe := range planEntries {
		planMap[pe.MenuItemID] = pe.IsVisible
	}

	var overrides []models.TenantMenuOverride
	database.DB.Where("tenant_id = ?", tenantID).Find(&overrides)
	overrideMap := make(map[uint]*bool)
	for _, ov := range overrides {
		v := ov.IsVisible
		overrideMap[ov.MenuItemID] = &v
	}

	type itemResolved struct {
		models.MenuItem
		VisibleByPlan     bool  `json:"visible_by_plan"`
		HasTenantOverride bool  `json:"has_tenant_override"`
		TenantOverride    *bool `json:"tenant_override"`
		EffectiveVisible  bool  `json:"effective_visible"`
	}

	var result []itemResolved
	for _, item := range items {
		visibleByPlan := true
		if pv, ok := planMap[item.ID]; ok {
			visibleByPlan = pv
		}
		hasOverride := false
		var tenantOverride *bool
		effective := visibleByPlan
		if ov, ok := overrideMap[item.ID]; ok {
			hasOverride = true
			tenantOverride = ov
			effective = *ov
		}
		result = append(result, itemResolved{
			MenuItem:          item,
			VisibleByPlan:     visibleByPlan,
			HasTenantOverride: hasOverride,
			TenantOverride:    tenantOverride,
			EffectiveVisible:  effective,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// SetTenantMenuOverride — PUT /api/tenant-menus/:tenant_id/:item_id
func SetTenantMenuOverride(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenant_id")
	itemID, _ := strconv.Atoi(chi.URLParam(r, "item_id"))

	var body struct {
		IsVisible    bool   `json:"is_visible"`
		OverriddenBy string `json:"overridden_by"`
		Notes        string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Upsert
	var existing models.TenantMenuOverride
	result := database.DB.Where("tenant_id = ? AND menu_item_id = ?", tenantID, itemID).First(&existing)
	if result.Error != nil {
		existing = models.TenantMenuOverride{
			TenantID:   tenantID,
			MenuItemID: uint(itemID),
		}
	}
	existing.IsVisible = body.IsVisible
	existing.OverriddenBy = body.OverriddenBy
	existing.Notes = body.Notes
	database.DB.Save(&existing)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(existing)
}

// DeleteTenantMenuOverride — DELETE /api/tenant-menus/:tenant_id/:item_id
func DeleteTenantMenuOverride(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenant_id")
	itemID, _ := strconv.Atoi(chi.URLParam(r, "item_id"))
	database.DB.Where("tenant_id = ? AND menu_item_id = ?", tenantID, itemID).
		Delete(&models.TenantMenuOverride{})
	w.WriteHeader(http.StatusNoContent)
}

// ── Role Menu ─────────────────────────────────────────────────────────────────

// GetRoleMenu — GET /api/role-menus/:app_code
func GetRoleMenu(w http.ResponseWriter, r *http.Request) {
	appCode := chi.URLParam(r, "app_code")
	var entries []models.RoleMenuItem
	database.DB.Preload("MenuItem").
		Where("app_code = ?", appCode).
		Order("role, menu_item_id").
		Find(&entries)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// SetRoleMenuItem — PUT /api/role-menus/:app_code/:role/:item_id
func SetRoleMenuItem(w http.ResponseWriter, r *http.Request) {
	appCode := chi.URLParam(r, "app_code")
	role := chi.URLParam(r, "role")
	itemID, _ := strconv.Atoi(chi.URLParam(r, "item_id"))

	var body struct {
		IsVisible bool `json:"is_visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entry := models.RoleMenuItem{
		AppCode:    appCode,
		Role:       role,
		MenuItemID: uint(itemID),
		IsVisible:  body.IsVisible,
	}
	database.DB.Save(&entry)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

// MenuRoutes — registra todas las rutas del módulo de menú
func MenuRoutes() *chi.Mux {
	r := chi.NewRouter()

	// Catálogo maestro
	r.Get("/items", ListMenuItems)
	r.Post("/items", CreateMenuItem)
	r.Put("/items/{id}", UpdateMenuItem)
	r.Delete("/items/{id}", DeleteMenuItem)

	// Por plan
	r.Get("/plan/{plan_code}", GetPlanMenu)
	r.Put("/plan/{plan_code}/{item_id}", SetPlanMenuItem)

	// Por tenant
	r.Get("/tenant/{tenant_id}", GetTenantMenu)
	r.Put("/tenant/{tenant_id}/{item_id}", SetTenantMenuOverride)
	r.Delete("/tenant/{tenant_id}/{item_id}", DeleteTenantMenuOverride)

	// Por rol
	r.Get("/role/{app_code}", GetRoleMenu)
	r.Put("/role/{app_code}/{role}/{item_id}", SetRoleMenuItem)

	return r
}
