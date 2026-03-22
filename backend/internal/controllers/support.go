package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"platform/internal/database"
	"platform/internal/models"

	"github.com/go-chi/chi/v5"
)

type TicketStats struct {
	Open        int64   `json:"open"`
	InProgress  int64   `json:"in_progress"`
	Resolved    int64   `json:"resolved"`
	AvgCSAT     float64 `json:"avg_csat"`
}

func GetTickets(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")
	tenantID := r.URL.Query().Get("tenant_id")
	assignedTo := r.URL.Query().Get("assigned_to")

	query := database.DB.Preload("Tenant").Preload("Tenant.Plan").Preload("AssignedTo").Order("created_at DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if tenantID != "" {
		query = query.Where("tenant_id = ?", tenantID)
	}
	if assignedTo != "" {
		query = query.Where("assigned_to_id = ?", assignedTo)
	}

	var tickets []models.SupportTicket
	query.Find(&tickets)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

func GetTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"ID inválido"}`, http.StatusBadRequest)
		return
	}

	var ticket models.SupportTicket
	if err := database.DB.
		Preload("Tenant").
		Preload("Tenant.Plan").
		Preload("AssignedTo").
		Preload("Messages").
		First(&ticket, id).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Ticket no encontrado"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticket)
}

func generateTicketNumber() string {
	var count int64
	database.DB.Model(&models.SupportTicket{}).Count(&count)
	return fmt.Sprintf("INF-%05d", count+1)
}

func calculateSLA(tenantID string) *time.Time {
	var tenant models.Tenant
	if err := database.DB.Preload("Plan").First(&tenant, "id = ?", tenantID).Error; err != nil {
		deadline := time.Now().Add(72 * time.Hour)
		return &deadline
	}

	hours := time.Duration(tenant.Plan.SupportSLAHours) * time.Hour
	if hours == 0 {
		hours = 72 * time.Hour
	}
	deadline := time.Now().Add(hours)
	return &deadline
}

func CreateTicket(w http.ResponseWriter, r *http.Request) {
	var ticket models.SupportTicket
	if err := json.NewDecoder(r.Body).Decode(&ticket); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	ticket.TicketNumber = generateTicketNumber()
	if ticket.Status == "" {
		ticket.Status = "open"
	}
	if ticket.Priority == "" {
		ticket.Priority = "medium"
	}
	ticket.SLADeadline = calculateSLA(ticket.TenantID)

	if err := database.DB.Create(&ticket).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error creando ticket"})
		return
	}

	database.DB.Preload("Tenant").Preload("AssignedTo").First(&ticket, ticket.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ticket)
}

func UpdateTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"ID inválido"}`, http.StatusBadRequest)
		return
	}

	var ticket models.SupportTicket
	if err := database.DB.First(&ticket, id).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Ticket no encontrado"})
		return
	}

	var updates struct {
		Status       *string `json:"status"`
		Priority     *string `json:"priority"`
		AssignedToID *uint   `json:"assigned_to_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	if updates.Status != nil {
		ticket.Status = *updates.Status
		if *updates.Status == "resolved" || *updates.Status == "closed" {
			now := time.Now()
			ticket.ResolvedAt = &now
		}
	}
	if updates.Priority != nil {
		ticket.Priority = *updates.Priority
	}
	if updates.AssignedToID != nil {
		ticket.AssignedToID = updates.AssignedToID
	}

	if err := database.DB.Save(&ticket).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error actualizando ticket"})
		return
	}

	database.DB.Preload("Tenant").Preload("Tenant.Plan").Preload("AssignedTo").Preload("Messages").First(&ticket, id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticket)
}

func AddMessage(w http.ResponseWriter, r *http.Request) {
	ticketID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"ID inválido"}`, http.StatusBadRequest)
		return
	}

	var ticket models.SupportTicket
	if err := database.DB.First(&ticket, ticketID).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Ticket no encontrado"})
		return
	}

	var msg models.SupportMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	msg.TicketID = uint(ticketID)

	// Registrar primera respuesta del agente
	if msg.AuthorType == "agent" && ticket.FirstResponseAt == nil {
		now := time.Now()
		ticket.FirstResponseAt = &now
		database.DB.Save(&ticket)
	}

	if err := database.DB.Create(&msg).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error creando mensaje"})
		return
	}

	// Actualizar status a in_progress si viene de un agente
	if msg.AuthorType == "agent" && ticket.Status == "open" {
		database.DB.Model(&ticket).Update("status", "in_progress")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

func RateTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"ID inválido"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	if req.Score < 1 || req.Score > 5 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Puntuación debe ser entre 1 y 5"})
		return
	}

	result := database.DB.Model(&models.SupportTicket{}).Where("id = ?", id).Update("satisfaction_score", req.Score)
	if result.RowsAffected == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Ticket no encontrado"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Calificación guardada"})
}

func GetTicketStats(w http.ResponseWriter, r *http.Request) {
	var stats TicketStats

	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "open").Count(&stats.Open)
	database.DB.Model(&models.SupportTicket{}).Where("status = ?", "in_progress").Count(&stats.InProgress)
	database.DB.Model(&models.SupportTicket{}).Where("status IN ?", []string{"resolved", "closed"}).Count(&stats.Resolved)

	var avgScore *float64
	database.DB.Model(&models.SupportTicket{}).
		Where("satisfaction_score IS NOT NULL").
		Select("AVG(satisfaction_score)").
		Scan(&avgScore)
	if avgScore != nil {
		stats.AvgCSAT = *avgScore
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func SupportRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(AuthRequired)
	r.Get("/", GetTickets)
	r.Post("/", CreateTicket)
	r.Get("/stats", GetTicketStats)
	r.Get("/{id}", GetTicket)
	r.Put("/{id}", UpdateTicket)
	r.Post("/{id}/messages", AddMessage)
	r.Post("/{id}/rate", RateTicket)
	return r
}
