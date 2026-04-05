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
	)
	if err != nil {
		log.Fatalf("Error en AutoMigrate: %v", err)
	}
	log.Println("AutoMigrate completado")
	seedECommerceAddons()
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
