package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"platform/internal/controllers"
	"platform/internal/database"
	"platform/internal/jobs"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

func main() {
	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("No se encontró archivo .env, usando variables del sistema")
	}

	// Conectar a la base de datos
	database.ConnectDB()

	// Cron: sincronizar cotizaciones BCU todos los días a las 20:30 hora Montevideo
	c := cron.New(cron.WithLocation(mustLoadLocation("America/Montevideo")))
	c.AddFunc("30 20 * * *", func() {
		if _, err := jobs.SyncExchangeRates(); err != nil {
			log.Printf("[cron] Error sincronizando cotizaciones: %v", err)
		}
	})
	c.Start()
	defer c.Stop()

	// Crear router
	r := chi.NewRouter()

	// Middlewares globales
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5174",
			"http://localhost:5173",
			"http://*",
			"https://*",
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Rutas de la API
	r.Route("/api", func(r chi.Router) {
		r.Mount("/auth", controllers.AuthRoutes())
		r.Mount("/plans", controllers.PlanRoutes())
		r.Mount("/tenants", controllers.TenantRoutes())
		r.Mount("/support", controllers.SupportRoutes())
		r.Mount("/dashboard", controllers.DashboardRoutes())
		r.Get("/dgi/rut", controllers.ConsultarRUT)

		// Add-ons e-commerce
		r.Mount("/addons/ecommerce", controllers.ECommerceAddonRoutes())

		// Add-ons por tenant — nested bajo /tenants/{tenantId}/addons
		r.Mount("/tenants/{tenantId}/addons", controllers.TenantAddonRoutes())
	})

	// Rutas internas (service-to-service, protegidas con X-Internal-Key)
	r.Get("/internal/rates", controllers.InternalRatesAuth(controllers.GetRates))
	r.Post("/internal/rates/sync", controllers.InternalRatesAuth(controllers.TriggerRateSync))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"innofactu-platform"}`))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("InnoFactu Platform API iniciando en puerto %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Error iniciando servidor: %v", err)
	}
}

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		log.Printf("Advertencia: no se pudo cargar timezone %s, usando UTC: %v", name, err)
		return time.UTC
	}
	return loc
}
