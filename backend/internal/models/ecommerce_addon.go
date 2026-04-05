package models

import "time"

// ──────────────────────────────────────────────────────────────────────────────
// ADD-ON E-COMMERCE — catálogo de conectores disponibles para contratar
// ──────────────────────────────────────────────────────────────────────────────

// ECommerceAddon representa un conector de plataforma e-commerce disponible para contratar.
// El precio puede ser diferente por plataforma (variable).
type ECommerceAddon struct {
	ID          uint    `json:"id" gorm:"primaryKey;autoIncrement"`
	Code        string  `json:"code" gorm:"uniqueIndex;not null"` // "woocommerce", "shopify", etc.
	Name        string  `json:"name" gorm:"not null"`
	Description string  `json:"description"`
	LogoURL     string  `json:"logo_url"`
	Category    string  `json:"category" gorm:"default:'ecommerce'"` // "ecommerce", "marketplace", "erp"

	// Precios mensuales en UYU
	PriceMonthlyUYU float64 `json:"price_monthly_uyu"`
	PriceYearlyUYU  float64 `json:"price_yearly_uyu"` // Precio anual (descuento aplicado)

	// Plan mínimo requerido (nil = todos los planes)
	RequiredPlanCode string `json:"required_plan_code"` // "" = todos, "pro" = solo Pro+, etc.

	// Características del conector
	SyncProducts bool `json:"sync_products" gorm:"default:true"`
	SyncVariants bool `json:"sync_variants" gorm:"default:true"`
	SyncImages   bool `json:"sync_images" gorm:"default:true"`
	SyncStock    bool `json:"sync_stock" gorm:"default:true"`
	SyncPrices   bool `json:"sync_prices" gorm:"default:true"`
	SyncOrders   bool `json:"sync_orders" gorm:"default:false"` // Importar pedidos como facturas

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ──────────────────────────────────────────────────────────────────────────────
// SUSCRIPCIÓN DE TENANT A UN ADD-ON
// ──────────────────────────────────────────────────────────────────────────────

// TenantAddonSubscription registra qué add-ons ha contratado cada tenant y hasta cuándo.
type TenantAddonSubscription struct {
	ID            uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	TenantID      string    `json:"tenant_id" gorm:"index;not null"` // UUID del tenant
	AddonID       uint      `json:"addon_id" gorm:"index;not null"`
	Addon         ECommerceAddon `json:"addon" gorm:"foreignKey:AddonID"`
	BillingCycle  string    `json:"billing_cycle" gorm:"default:'monthly'"` // "monthly" | "yearly"
	PricePaid     float64   `json:"price_paid" gorm:"type:numeric(10,2)"`    // Precio al momento de contratar
	StartsAt      time.Time `json:"starts_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	AutoRenew     bool      `json:"auto_renew" gorm:"default:true"`
	Status        string    `json:"status" gorm:"default:'active'"` // "active", "expired", "cancelled"
	CancelledAt   *time.Time `json:"cancelled_at"`
	Notes         string    `json:"notes"` // Notas internas del admin
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// IsActive devuelve true si la suscripción está activa y no expiró.
func (s *TenantAddonSubscription) IsActiveNow() bool {
	return s.Status == "active" && time.Now().Before(s.ExpiresAt)
}
