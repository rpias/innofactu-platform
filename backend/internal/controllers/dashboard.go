package controllers

import (
	"encoding/json"
	"net/http"

	"platform/internal/database"
	"platform/internal/models"

	"github.com/go-chi/chi/v5"
)

type DashboardStats struct {
	TotalTenants    int64   `json:"total_tenants"`
	ActiveTenants   int64   `json:"active_tenants"`
	TrialTenants    int64   `json:"trial_tenants"`
	OpenTickets     int64   `json:"open_tickets"`
	CriticalTickets int64   `json:"critical_tickets"`
	MRREstimate     float64 `json:"mrr_estimate"`
	RecentTenants   []models.Tenant        `json:"recent_tenants"`
	CriticalTicketsList []models.SupportTicket `json:"critical_tickets_list"`
}

func GetDashboard(w http.ResponseWriter, r *http.Request) {
	var stats DashboardStats

	database.DB.Model(&models.Tenant{}).Count(&stats.TotalTenants)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "active").Count(&stats.ActiveTenants)
	database.DB.Model(&models.Tenant{}).Where("status = ?", "trial").Count(&stats.TrialTenants)
	database.DB.Model(&models.SupportTicket{}).Where("status IN ?", []string{"open", "in_progress"}).Count(&stats.OpenTickets)
	database.DB.Model(&models.SupportTicket{}).Where("priority IN ? AND status IN ?", []string{"critical", "high"}, []string{"open", "in_progress"}).Count(&stats.CriticalTickets)

	// Calcular MRR estimado sumando precios de planes activos
	type MRRResult struct {
		Total float64
	}
	var mrrResult MRRResult
	database.DB.Raw(`
		SELECT COALESCE(SUM(p.price_monthly_uyu), 0) as total
		FROM tenants t
		JOIN plans p ON t.plan_id = p.id
		WHERE t.status = 'active'
	`).Scan(&mrrResult)
	stats.MRREstimate = mrrResult.Total

	// Últimas 5 empresas
	database.DB.Preload("Plan").Order("created_at DESC").Limit(5).Find(&stats.RecentTenants)

	// Tickets críticos/urgentes abiertos
	database.DB.Preload("Tenant").Preload("AssignedTo").
		Where("priority IN ? AND status IN ?", []string{"critical", "high"}, []string{"open", "in_progress"}).
		Order("created_at ASC").
		Limit(5).
		Find(&stats.CriticalTicketsList)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func DashboardRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(AuthRequired)
	r.Get("/", GetDashboard)
	return r
}
