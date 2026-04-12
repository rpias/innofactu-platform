package models

import "time"

// MenuItem — catálogo maestro de ítems de menú para todas las apps del ecosistema.
// Almacenado en innofactu_platform.menu_items — fuente única de verdad.
type MenuItem struct {
	ID uint `gorm:"primaryKey;autoIncrement" json:"id"`

	// Identificación
	AppCode string `gorm:"not null;index" json:"app_code"` // "erp", "pos", "platform", "ecommerce"
	Key     string `gorm:"not null;uniqueIndex" json:"key"` // "dashboard", "invoices", "reports.sales"

	// Visualización
	Label        string `gorm:"not null" json:"label"`         // "Diario de Ventas"
	Icon         string `json:"icon"`                          // nombre lucide-react: "ClipboardList"
	Path         string `json:"path"`                          // "/invoices"
	Section      string `json:"section"`                       // "facturacion", "stock", "administracion", "herramientas"
	SectionLabel string `json:"section_label"`                 // "Facturación" (etiqueta legible del grupo)
	SortOrder    int    `gorm:"default:0" json:"sort_order"`
	ParentID     *uint  `json:"parent_id"` // para submenús; null = primer nivel

	// Restricciones de acceso
	RequiredFeature string `json:"required_feature"` // "" | "efactura" | "advanced_reports" | "api_access" | "multi_sucursal"
	RequiredAddon   string `json:"required_addon"`   // "" | "woocommerce" | "shopify" (code de ECommerceAddon)
	DefaultRoles    string `json:"default_roles"`    // JSON array: ["admin"] | ["admin","user"]

	// Extras
	BadgeKey    string `json:"badge_key"`   // "" | "low_stock_count" — fuente de badge dinámico
	Description string `json:"description"` // documentación interna

	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PlanMenuItem — visibilidad base de un ítem según el plan contratado.
// Un ítem sin entrada aquí se considera VISIBLE por defecto en todos los planes.
type PlanMenuItem struct {
	PlanCode   string `gorm:"primaryKey" json:"plan_code"`
	MenuItemID uint   `gorm:"primaryKey" json:"menu_item_id"`
	IsVisible  bool   `gorm:"default:true" json:"is_visible"`

	// Relaciones (solo para lecturas enriquecidas)
	MenuItem *MenuItem `gorm:"foreignKey:MenuItemID;references:ID" json:"menu_item,omitempty"`
}

// TenantMenuOverride — el superadmin puede forzar visibilidad para un tenant específico,
// independientemente del plan. Puede AÑADIR (is_visible=true) o QUITAR (is_visible=false).
type TenantMenuOverride struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID   string `gorm:"not null;index" json:"tenant_id"`
	MenuItemID uint   `gorm:"not null" json:"menu_item_id"`
	IsVisible  bool   `json:"is_visible"`

	OverriddenBy string `json:"overridden_by"` // email del admin que hizo el cambio
	Notes        string `json:"notes"`

	MenuItem *MenuItem `gorm:"foreignKey:MenuItemID;references:ID" json:"menu_item,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RoleMenuItem — visibilidad por rol, global para toda la app.
// Define qué roles pueden ver cada ítem por defecto (refinamiento sobre el plan).
type RoleMenuItem struct {
	AppCode    string `gorm:"primaryKey" json:"app_code"` // "erp", "pos"
	Role       string `gorm:"primaryKey" json:"role"`      // "admin", "user", "cashier"
	MenuItemID uint   `gorm:"primaryKey" json:"menu_item_id"`
	IsVisible  bool   `gorm:"default:true" json:"is_visible"`

	MenuItem *MenuItem `gorm:"foreignKey:MenuItemID;references:ID" json:"menu_item,omitempty"`
}
