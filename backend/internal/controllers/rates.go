package controllers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"platform/internal/database"
	"platform/internal/jobs"
	"platform/internal/models"
)

// InternalRatesAuth protege los endpoints de rates con X-Internal-Key.
func InternalRatesAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		secret := os.Getenv("INTERNAL_API_KEY")
		if secret == "" {
			secret = "innofactu-internal-2026"
		}
		if r.Header.Get("X-Internal-Key") != secret {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// GetRates devuelve las cotizaciones del BCU para una fecha dada.
//
// GET /internal/rates?date=2026-04-04
// GET /internal/rates                   → usa fecha de hoy
//
// Requiere header X-Internal-Key.
func GetRates(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	var fecha time.Time
	if dateStr == "" {
		fecha = time.Now()
	} else {
		var err error
		fecha, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			http.Error(w, `{"error":"date inválida, usar YYYY-MM-DD"}`, http.StatusBadRequest)
			return
		}
	}

	var rates []models.ExchangeRate
	result := database.DB.
		Where("rate_date::date = ?::date", fecha).
		Order("iso_code").
		Find(&rates)

	if result.Error != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}

// TriggerRateSync dispara una sincronización manual con el BCU.
//
// POST /internal/rates/sync
// Requiere header X-Internal-Key.
func TriggerRateSync(w http.ResponseWriter, r *http.Request) {
	result, err := jobs.SyncExchangeRates()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
