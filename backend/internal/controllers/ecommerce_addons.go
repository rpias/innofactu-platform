package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"platform/internal/database"
	"platform/internal/models"

	"github.com/go-chi/chi/v5"
)

// ──────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE ADD-ONS (solo super admin puede crear/editar)
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/addons/ecommerce
// Lista todos los add-ons disponibles (público — para mostrar en pricing page).
func ListECommerceAddons(w http.ResponseWriter, r *http.Request) {
	var addons []models.ECommerceAddon
	database.DB.Where("is_active = ?", true).Order("sort_order ASC, name ASC").Find(&addons)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addons)
}

// GET /api/addons/ecommerce/{id}
func GetECommerceAddon(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var addon models.ECommerceAddon
	if err := database.DB.First(&addon, id).Error; err != nil {
		http.Error(w, "Add-on no encontrado", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addon)
}

// POST /api/addons/ecommerce — solo super admin
func CreateECommerceAddon(w http.ResponseWriter, r *http.Request) {
	var addon models.ECommerceAddon
	if err := json.NewDecoder(r.Body).Decode(&addon); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if addon.Code == "" || addon.Name == "" {
		http.Error(w, `{"error":"code y name son requeridos"}`, http.StatusBadRequest)
		return
	}
	if err := database.DB.Create(&addon).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(addon)
}

// PUT /api/addons/ecommerce/{id} — solo super admin
func UpdateECommerceAddon(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var addon models.ECommerceAddon
	if err := database.DB.First(&addon, id).Error; err != nil {
		http.Error(w, "Add-on no encontrado", http.StatusNotFound)
		return
	}
	var payload map[string]interface{}
	json.NewDecoder(r.Body).Decode(&payload)
	database.DB.Model(&addon).Updates(payload)
	database.DB.First(&addon, id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addon)
}

// ──────────────────────────────────────────────────────────────────────────────
// SUSCRIPCIONES DE TENANTS A ADD-ONS
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/tenants/{tenantId}/addons
// Lista los add-ons contratados por un tenant.
func GetTenantAddons(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	var subs []models.TenantAddonSubscription
	database.DB.Preload("Addon").
		Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		Find(&subs)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subs)
}

// GET /api/tenants/{tenantId}/addons/active
// Lista solo los add-ons activos (no expirados) de un tenant.
// Usado internamente por el ERP para verificar acceso.
func GetTenantActiveAddons(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	var subs []models.TenantAddonSubscription
	database.DB.Preload("Addon").
		Where("tenant_id = ? AND status = 'active' AND expires_at > ?", tenantID, time.Now()).
		Find(&subs)

	// Devolver solo los códigos de addon activos (más fácil de consumir)
	activeCodes := make([]string, 0, len(subs))
	for _, s := range subs {
		activeCodes = append(activeCodes, s.Addon.Code)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"subscriptions":  subs,
		"active_addons":  activeCodes,
	})
}

// POST /api/tenants/{tenantId}/addons — super admin activa un add-on para un tenant
func ActivateTenantAddon(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	var payload struct {
		AddonID      uint    `json:"addon_id"`
		BillingCycle string  `json:"billing_cycle"` // "monthly" | "yearly"
		Months       int     `json:"months"`         // Cantidad de meses a activar
		PricePaid    float64 `json:"price_paid"`     // Precio efectivamente cobrado
		AutoRenew    bool    `json:"auto_renew"`
		Notes        string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if payload.AddonID == 0 {
		http.Error(w, `{"error":"addon_id requerido"}`, http.StatusBadRequest)
		return
	}

	// Verificar que el addon existe
	var addon models.ECommerceAddon
	if err := database.DB.First(&addon, payload.AddonID).Error; err != nil {
		http.Error(w, "Add-on no encontrado", http.StatusNotFound)
		return
	}

	// Verificar que el tenant existe
	var tenant models.Tenant
	if err := database.DB.Where("id = ?", tenantID).First(&tenant).Error; err != nil {
		http.Error(w, "Tenant no encontrado", http.StatusNotFound)
		return
	}

	months := payload.Months
	if months <= 0 {
		months = 1
	}
	if payload.BillingCycle == "yearly" {
		months = 12
	}

	// Calcular precio si no se especificó
	pricePaid := payload.PricePaid
	if pricePaid == 0 {
		if payload.BillingCycle == "yearly" {
			pricePaid = addon.PriceYearlyUYU
		} else {
			pricePaid = addon.PriceMonthlyUYU * float64(months)
		}
	}

	now := time.Now()
	sub := models.TenantAddonSubscription{
		TenantID:     tenantID,
		AddonID:      payload.AddonID,
		BillingCycle: payload.BillingCycle,
		PricePaid:    pricePaid,
		StartsAt:     now,
		ExpiresAt:    now.AddDate(0, months, 0),
		AutoRenew:    payload.AutoRenew,
		Status:       "active",
		Notes:        payload.Notes,
	}

	// Si ya tiene una suscripción activa al mismo addon, extender en lugar de crear nueva
	var existing models.TenantAddonSubscription
	if database.DB.Where("tenant_id = ? AND addon_id = ? AND status = 'active'", tenantID, payload.AddonID).First(&existing).Error == nil {
		// Extender la fecha de expiración
		if existing.ExpiresAt.After(now) {
			sub.StartsAt = existing.StartsAt
			sub.ExpiresAt = existing.ExpiresAt.AddDate(0, months, 0)
		}
		database.DB.Delete(&existing)
	}

	if err := database.DB.Create(&sub).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	database.DB.Preload("Addon").First(&sub, sub.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sub)
}

// DELETE /api/tenants/{tenantId}/addons/{subId} — cancela una suscripción
func CancelTenantAddon(w http.ResponseWriter, r *http.Request) {
	subID := chi.URLParam(r, "subId")
	now := time.Now()
	database.DB.Model(&models.TenantAddonSubscription{}).
		Where("id = ?", subID).
		Updates(map[string]interface{}{
			"status":       "cancelled",
			"auto_renew":   false,
			"cancelled_at": &now,
		})
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/tenants/{tenantId}/addons/check/{addonCode}
// Verifica rápidamente si un tenant tiene activo un add-on específico.
// Usado por el ERP para decidir si mostrar u ocultar funcionalidad.
func CheckTenantAddonAccess(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	addonCode := chi.URLParam(r, "addonCode")

	var count int64
	database.DB.Model(&models.TenantAddonSubscription{}).
		Joins("JOIN e_commerce_addons ON e_commerce_addons.id = tenant_addon_subscriptions.addon_id").
		Where("tenant_addon_subscriptions.tenant_id = ? AND e_commerce_addons.code = ? AND tenant_addon_subscriptions.status = 'active' AND tenant_addon_subscriptions.expires_at > ?",
			tenantID, addonCode, time.Now()).
		Count(&count)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"has_access": count > 0})
}

// ──────────────────────────────────────────────────────────────────────────────
// RUTAS
// ──────────────────────────────────────────────────────────────────────────────

func ECommerceAddonRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", ListECommerceAddons)
	r.Post("/", CreateECommerceAddon)
	r.Get("/{id}", GetECommerceAddon)
	r.Put("/{id}", UpdateECommerceAddon)
	return r
}

func TenantAddonRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", GetTenantAddons)
	r.Get("/active", GetTenantActiveAddons)
	r.Post("/", ActivateTenantAddon)
	r.Delete("/{subId}", CancelTenantAddon)
	r.Get("/check/{addonCode}", CheckTenantAddonAccess)
	return r
}
