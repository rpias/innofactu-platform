package main

import (
	"log"
	"net/http"
	"os"

	"platform/internal/controllers"
	"platform/internal/database"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("No se encontró archivo .env, usando variables del sistema")
	}

	// Conectar a la base de datos
	database.ConnectDB()

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
	})

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
