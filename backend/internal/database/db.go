package database

import (
	"fmt"
	"log"
	"os"
	"platform/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDB() {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	if host == "" {
		host = "localhost"
	}
	if user == "" {
		user = "postgres"
	}
	if dbname == "" {
		dbname = "innofactu_platform"
	}
	if port == "" {
		port = "5432"
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=America/Montevideo",
		host, user, password, dbname, port,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Error conectando a la base de datos: %v", err)
	}

	log.Println("Conexión a la base de datos establecida")

	autoMigrate()
	SeedData()
}

func autoMigrate() {
	err := DB.AutoMigrate(
		&models.Plan{},
		&models.Tenant{},
		&models.PlatformUser{},
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.TenantSubscription{},
		&models.TenantUsage{},
		&models.ExchangeRate{},
		// Add-ons e-commerce
		&models.ECommerceAddon{},
		&models.TenantAddonSubscription{},
		// Certificado DGI global
		&models.PlatformDGICert{},
		// Sistema de menú dinámico
		&models.MenuItem{},
		&models.PlanMenuItem{},
		&models.TenantMenuOverride{},
		&models.RoleMenuItem{},
	)
	if err != nil {
		log.Fatalf("Error en AutoMigrate: %v", err)
	}
	log.Println("AutoMigrate completado")
	seedECommerceAddons()
	seedMenuItems()
}

func seedECommerceAddons() {
	var count int64
	DB.Model(&models.ECommerceAddon{}).Count(&count)
	if count > 0 {
		return
	}
	addons := []models.ECommerceAddon{
		{Code: "woocommerce", Name: "WooCommerce", Category: "ecommerce",
			Description:     "Sincroniza catálogo, stock y precios con tu tienda WooCommerce (WordPress).",
			PriceMonthlyUYU: 490, PriceYearlyUYU: 4900,
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true, SyncOrders: false,
			IsActive: true, SortOrder: 1},
		{Code: "tiendanube", Name: "Tiendanube", Category: "ecommerce",
			Description:     "Integración con Tiendanube (Nuvemshop), líder en Latinoamérica.",
			PriceMonthlyUYU: 490, PriceYearlyUYU: 4900,
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true, SyncOrders: true,
			IsActive: true, SortOrder: 2},
		{Code: "shopify", Name: "Shopify", Category: "ecommerce",
			Description:     "Sincroniza con Shopify. Compatible con todos los planes de Shopify.",
			PriceMonthlyUYU: 790, PriceYearlyUYU: 7900,
			RequiredPlanCode: "profesional",
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true, SyncOrders: true,
			IsActive: true, SortOrder: 3},
		{Code: "bigcommerce", Name: "BigCommerce", Category: "ecommerce",
			Description:     "Integración con BigCommerce para tiendas con alto volumen.",
			PriceMonthlyUYU: 790, PriceYearlyUYU: 7900,
			RequiredPlanCode: "profesional",
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 4},
		{Code: "prestashop", Name: "PrestaShop", Category: "ecommerce",
			Description:     "Conecta con tiendas PrestaShop vía Webservice API.",
			PriceMonthlyUYU: 490, PriceYearlyUYU: 4900,
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 5},
		{Code: "magento", Name: "Adobe Commerce (Magento)", Category: "ecommerce",
			Description:     "Integración enterprise con Adobe Commerce / Magento 2.",
			PriceMonthlyUYU: 1490, PriceYearlyUYU: 14900,
			RequiredPlanCode: "empresarial",
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 6},
		{Code: "opencart", Name: "OpenCart", Category: "ecommerce",
			Description:     "Sincronización básica con tiendas OpenCart.",
			PriceMonthlyUYU: 390, PriceYearlyUYU: 3900,
			SyncProducts: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 7},
		{Code: "ecwid", Name: "Ecwid", Category: "ecommerce",
			Description:     "Conecta con tu widget de tienda Ecwid embebido en cualquier sitio.",
			PriceMonthlyUYU: 390, PriceYearlyUYU: 3900,
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 8},
		{Code: "medusa", Name: "Medusa", Category: "ecommerce",
			Description:     "Headless commerce open-source. Para equipos con desarrollo propio.",
			PriceMonthlyUYU: 590, PriceYearlyUYU: 5900,
			RequiredPlanCode: "profesional",
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 9},
		{Code: "saleor", Name: "Saleor", Category: "ecommerce",
			Description:     "Plataforma headless GraphQL para arquitecturas avanzadas.",
			PriceMonthlyUYU: 590, PriceYearlyUYU: 5900,
			RequiredPlanCode: "profesional",
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 10},
		{Code: "odoo", Name: "Odoo", Category: "erp",
			Description:     "Sincronización bidireccional con Odoo ERP + e-commerce.",
			PriceMonthlyUYU: 990, PriceYearlyUYU: 9900,
			RequiredPlanCode: "empresarial",
			SyncProducts: true, SyncVariants: true, SyncStock: true, SyncPrices: true, SyncOrders: true,
			IsActive: true, SortOrder: 11},
		{Code: "wix", Name: "Wix eCommerce", Category: "ecommerce",
			Description:     "Integración con tiendas Wix eCommerce.",
			PriceMonthlyUYU: 490, PriceYearlyUYU: 4900,
			SyncProducts: true, SyncVariants: true, SyncImages: true, SyncStock: true, SyncPrices: true,
			IsActive: true, SortOrder: 12},
	}
	if err := DB.Create(&addons).Error; err != nil {
		log.Printf("Error creando add-ons e-commerce: %v", err)
	} else {
		log.Printf("Add-ons e-commerce creados: %d conectores", len(addons))
	}
}

func SeedData() {
	// Crear planes si no existen
	var count int64
	DB.Model(&models.Plan{}).Count(&count)
	if count == 0 {
		plans := []models.Plan{
			{
				Code:                "basico",
				Name:                "Básico",
				PriceMonthlyUYU:     990,
				PriceYearlyUYU:      9900,
				MaxUsers:            3,
				MaxInvoicesPerMonth: 100,
				MaxArticles:         200,
				MaxContacts:         300,
				MaxSucursales:       1,
				MaxStorageMB:        500,
				EfacturaEnabled:     true,
				MultiSucursalEnabled: false,
				APIAccessEnabled:    false,
				WhiteLabelEnabled:   false,
				AdvancedReports:     false,
				SupportLevel:        "email",
				SupportSLAHours:     72,
				IsActive:            true,
				IsPublic:            true,
				SortOrder:           1,
			},
			{
				Code:                "profesional",
				Name:                "Profesional",
				PriceMonthlyUYU:     2490,
				PriceYearlyUYU:      24900,
				MaxUsers:            10,
				MaxInvoicesPerMonth: 500,
				MaxArticles:         2000,
				MaxContacts:         5000,
				MaxSucursales:       3,
				MaxStorageMB:        5000,
				EfacturaEnabled:     true,
				MultiSucursalEnabled: true,
				APIAccessEnabled:    true,
				WhiteLabelEnabled:   false,
				AdvancedReports:     true,
				SupportLevel:        "priority",
				SupportSLAHours:     24,
				IsActive:            true,
				IsPublic:            true,
				SortOrder:           2,
			},
			{
				Code:                "empresarial",
				Name:                "Empresarial",
				PriceMonthlyUYU:     5990,
				PriceYearlyUYU:      59900,
				MaxUsers:            -1, // ilimitado
				MaxInvoicesPerMonth: -1, // ilimitado
				MaxArticles:         -1,
				MaxContacts:         -1,
				MaxSucursales:       -1,
				MaxStorageMB:        50000,
				EfacturaEnabled:     true,
				MultiSucursalEnabled: true,
				APIAccessEnabled:    true,
				WhiteLabelEnabled:   true,
				AdvancedReports:     true,
				SupportLevel:        "dedicated",
				SupportSLAHours:     4,
				IsActive:            true,
				IsPublic:            true,
				SortOrder:           3,
			},
		}
		if err := DB.Create(&plans).Error; err != nil {
			log.Printf("Error creando planes: %v", err)
		} else {
			log.Println("Planes creados correctamente")
		}
	}

	// Crear super admin si no existe
	var adminCount int64
	DB.Model(&models.PlatformUser{}).Where("email = ?", "admin@innofactu.com").Count(&adminCount)
	if adminCount == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("Admin2024!"), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hasheando contraseña: %v", err)
			return
		}
		admin := models.PlatformUser{
			Email:        "admin@innofactu.com",
			PasswordHash: string(hash),
			FullName:     "Super Administrador",
			Role:         "super_admin",
			IsActive:     true,
		}
		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("Error creando super admin: %v", err)
		} else {
			log.Println("Super admin creado: admin@innofactu.com / Admin2024!")
		}
	}
}

// ── Seed de Menú ──────────────────────────────────────────────────────────────

func seedMenuItems() {
	var count int64
	DB.Model(&models.MenuItem{}).Count(&count)
	if count > 0 {
		return
	}

	// Definición completa de los ítems del ERP
	type itemDef struct {
		Key          string
		Label        string
		Icon         string
		Path         string
		Section      string
		SectionLabel string
		SortOrder    int
		ReqFeature   string
		DefaultRoles string // JSON array
		BadgeKey     string
	}

	items := []itemDef{
		// ── Sin sección ───────────────────────────────
		{Key: "dashboard", Label: "Página principal", Icon: "LayoutDashboard", Path: "/", Section: "", SectionLabel: "", SortOrder: 0, DefaultRoles: `["admin","user"]`},

		// ── Facturación ───────────────────────────────
		{Key: "billing", Label: "Facturador", Icon: "Receipt", Path: "/billing", Section: "facturacion", SectionLabel: "Facturación", SortOrder: 10, DefaultRoles: `["admin","user"]`},
		{Key: "invoices", Label: "Diario de Ventas", Icon: "ClipboardList", Path: "/invoices", Section: "facturacion", SectionLabel: "Facturación", SortOrder: 11, DefaultRoles: `["admin","user"]`},
		{Key: "purchases", Label: "Compras", Icon: "ShoppingCart", Path: "/purchases", Section: "facturacion", SectionLabel: "Facturación", SortOrder: 12, DefaultRoles: `["admin","user"]`},
		{Key: "purchases.history", Label: "Historial Compras", Icon: "ClipboardList", Path: "/purchases/history", Section: "facturacion", SectionLabel: "Facturación", SortOrder: 13, DefaultRoles: `["admin","user"]`},
		{Key: "cash", Label: "Tesorería / Caja", Icon: "Wallet", Path: "/cash", Section: "facturacion", SectionLabel: "Facturación", SortOrder: 14, DefaultRoles: `["admin","user"]`},

		// ── Stock ─────────────────────────────────────
		{Key: "inventory", Label: "Catálogo de Artículos", Icon: "Package", Path: "/inventory", Section: "stock", SectionLabel: "Stock", SortOrder: 20, DefaultRoles: `["admin","user"]`, BadgeKey: ""},
		{Key: "article-families", Label: "Tipos de Artículo", Icon: "Layers", Path: "/article-families", Section: "stock", SectionLabel: "Stock", SortOrder: 21, DefaultRoles: `["admin","user"]`},
		{Key: "brands-units", Label: "Marcas y Unidades", Icon: "Tag", Path: "/brands-units", Section: "stock", SectionLabel: "Stock", SortOrder: 22, DefaultRoles: `["admin"]`},
		{Key: "stock-adjust", Label: "Ajuste de Stock", Icon: "ArrowUpDown", Path: "/stock-adjust", Section: "stock", SectionLabel: "Stock", SortOrder: 23, DefaultRoles: `["admin","user"]`},
		{Key: "stock-report", Label: "Informes de Stock", Icon: "TrendingDown", Path: "/stock-report", Section: "stock", SectionLabel: "Stock", SortOrder: 24, DefaultRoles: `["admin","user"]`},

		// ── Administración ────────────────────────────
		{Key: "accounting", Label: "Contabilidad", Icon: "BookOpen", Path: "/accounting", Section: "administracion", SectionLabel: "Administración", SortOrder: 30, DefaultRoles: `["admin"]`},
		{Key: "reports", Label: "Reportes", Icon: "BarChart2", Path: "/reports", Section: "administracion", SectionLabel: "Administración", SortOrder: 31, ReqFeature: "advanced_reports", DefaultRoles: `["admin"]`},
		{Key: "contacts", Label: "Contactos", Icon: "Users", Path: "/contacts", Section: "administracion", SectionLabel: "Administración", SortOrder: 32, DefaultRoles: `["admin","user"]`},
		{Key: "users", Label: "Usuarios", Icon: "UserCog", Path: "/users", Section: "administracion", SectionLabel: "Administración", SortOrder: 33, DefaultRoles: `["admin"]`},

		// ── Herramientas ──────────────────────────────
		{Key: "price-lists", Label: "Listas de Precios", Icon: "Tag", Path: "/price-lists", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 40, DefaultRoles: `["admin"]`},
		{Key: "currencies", Label: "Organizar Divisas", Icon: "DollarSign", Path: "/currencies", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 41, DefaultRoles: `["admin"]`},
		{Key: "import", Label: "Importar / Exportar", Icon: "FileSpreadsheet", Path: "/import", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 42, ReqFeature: "api_access", DefaultRoles: `["admin"]`},
		{Key: "efactura", Label: "e-Factura DGI", Icon: "Zap", Path: "/efactura", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 43, ReqFeature: "efactura", DefaultRoles: `["admin"]`},
		{Key: "integraciones", Label: "Integraciones E-Commerce", Icon: "Globe", Path: "/integraciones", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 44, DefaultRoles: `["admin"]`},
		{Key: "settings", Label: "Configuración", Icon: "Settings", Path: "/settings", Section: "herramientas", SectionLabel: "Herramientas", SortOrder: 45, DefaultRoles: `["admin"]`},
	}

	var menuItems []models.MenuItem
	for _, d := range items {
		menuItems = append(menuItems, models.MenuItem{
			AppCode:      "erp",
			Key:          d.Key,
			Label:        d.Label,
			Icon:         d.Icon,
			Path:         d.Path,
			Section:      d.Section,
			SectionLabel: d.SectionLabel,
			SortOrder:    d.SortOrder,
			RequiredFeature: d.ReqFeature,
			DefaultRoles: d.DefaultRoles,
			BadgeKey:     d.BadgeKey,
			IsActive:     true,
		})
	}

	if err := DB.Create(&menuItems).Error; err != nil {
		log.Printf("[menu] Error creando menu_items: %v", err)
		return
	}
	log.Printf("[menu] %d menu_items del ERP creados", len(menuItems))

	// Cargar el mapa key → ID para el seed de plan_menu_items
	itemMap := make(map[string]uint)
	var saved []models.MenuItem
	DB.Where("app_code = ?", "erp").Find(&saved)
	for _, it := range saved {
		itemMap[it.Key] = it.ID
	}

	// ── Visibilidad por plan ───────────────────────────────────────────────────
	// basico: excluye accounting, reports, price-lists, import, integraciones
	basico := map[string]bool{
		"dashboard": true, "billing": true, "invoices": true, "purchases": true,
		"purchases.history": true, "cash": true, "inventory": true, "article-families": true,
		"brands-units": true, "stock-adjust": true, "stock-report": true,
		"accounting": false, "reports": false, "contacts": true, "users": true,
		"price-lists": false, "currencies": true, "import": false,
		"efactura": true, "integraciones": false, "settings": true,
	}
	// profesional: todo excepto nada (acceso completo)
	profesional := map[string]bool{
		"dashboard": true, "billing": true, "invoices": true, "purchases": true,
		"purchases.history": true, "cash": true, "inventory": true, "article-families": true,
		"brands-units": true, "stock-adjust": true, "stock-report": true,
		"accounting": true, "reports": true, "contacts": true, "users": true,
		"price-lists": true, "currencies": true, "import": true,
		"efactura": true, "integraciones": true, "settings": true,
	}
	// empresarial: igual a profesional (acceso completo)
	empresarial := profesional

	planVisibility := map[string]map[string]bool{
		"basico":      basico,
		"profesional": profesional,
		"empresarial": empresarial,
	}

	var planItems []models.PlanMenuItem
	for planCode, visMap := range planVisibility {
		for key, visible := range visMap {
			id, ok := itemMap[key]
			if !ok {
				continue
			}
			planItems = append(planItems, models.PlanMenuItem{
				PlanCode:   planCode,
				MenuItemID: id,
				IsVisible:  visible,
			})
		}
	}
	if err := DB.Create(&planItems).Error; err != nil {
		log.Printf("[menu] Error creando plan_menu_items: %v", err)
		return
	}
	log.Printf("[menu] %d plan_menu_items creados", len(planItems))

	// ── Visibilidad por rol ────────────────────────────────────────────────────
	// admin: ve todo
	// user: ve menos (sin accounting, users, brands-units, price-lists, currencies, import, efactura, integraciones, settings)
	adminItems := []string{
		"dashboard", "billing", "invoices", "purchases", "purchases.history", "cash",
		"inventory", "article-families", "brands-units", "stock-adjust", "stock-report",
		"accounting", "reports", "contacts", "users",
		"price-lists", "currencies", "import", "efactura", "integraciones", "settings",
	}
	userItems := []string{
		"dashboard", "billing", "invoices", "purchases", "purchases.history", "cash",
		"inventory", "article-families", "stock-adjust", "stock-report", "contacts",
	}

	roleVisMap := map[string][]string{
		"admin": adminItems,
		"user":  userItems,
	}

	// Construir set de visibles por rol
	var roleItems []models.RoleMenuItem
	for role, visibleKeys := range roleVisMap {
		visSet := make(map[string]bool)
		for _, k := range visibleKeys {
			visSet[k] = true
		}
		for _, item := range saved {
			roleItems = append(roleItems, models.RoleMenuItem{
				AppCode:    "erp",
				Role:       role,
				MenuItemID: item.ID,
				IsVisible:  visSet[item.Key],
			})
		}
	}
	if err := DB.Create(&roleItems).Error; err != nil {
		log.Printf("[menu] Error creando role_menu_items: %v", err)
		return
	}
	log.Printf("[menu] %d role_menu_items creados", len(roleItems))
}
