// Package jobs contiene los trabajos programados (cron jobs) de la plataforma.
package jobs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"platform/internal/database"
	"platform/internal/models"
	"platform/pkg/bcu"
)

// SyncExchangeRates consulta el BCU, guarda las cotizaciones en la BD compartida
// y luego notifica al ERP para que las distribuya a los schemas de los tenants.
//
// Retorna un resumen de la sincronización (para loguear o devolver vía API).
func SyncExchangeRates() (*SyncResult, error) {
	// BCU publica las cotizaciones del día hábil anterior.
	// Consultamos "hoy": si es inhábil, el BCU devuelve el último día válido.
	fecha := time.Now().In(montevideoLoc())

	log.Printf("[currency_sync] Iniciando sincronización BCU para fecha %s", fecha.Format("2006-01-02"))

	cotizaciones, err := bcu.GetCotizaciones(fecha)
	if err != nil {
		return nil, fmt.Errorf("error consultando BCU: %w", err)
	}

	result := &SyncResult{SyncedAt: time.Now(), Rates: make([]SyncedRate, 0, len(cotizaciones))}

	for _, cot := range cotizaciones {
		if cot.Compra == 0 && cot.Venta == 0 {
			log.Printf("[currency_sync] %s sin cotización, omitiendo", cot.ISOCode)
			continue
		}

		rateDate := cot.Fecha
		if rateDate.IsZero() {
			rateDate = fecha
		}
		// Normalizar a solo fecha (sin hora)
		rateDate = time.Date(rateDate.Year(), rateDate.Month(), rateDate.Day(), 0, 0, 0, 0, rateDate.Location())

		rate := models.ExchangeRate{
			ISOCode:  cot.ISOCode,
			RateDate: rateDate,
			BuyRate:  cot.Compra,
			SellRate: cot.Venta,
			Source:   "BCU",
			SyncedAt: time.Now(),
		}

		// Upsert: si ya existe un registro para este iso_code + rate_date, actualizarlo
		err := database.DB.
			Where("iso_code = ? AND rate_date::date = ?::date", rate.ISOCode, rate.RateDate).
			Assign(models.ExchangeRate{
				BuyRate:  rate.BuyRate,
				SellRate: rate.SellRate,
				SyncedAt: rate.SyncedAt,
			}).
			FirstOrCreate(&rate).Error

		if err != nil {
			log.Printf("[currency_sync] Error guardando %s: %v", cot.ISOCode, err)
			continue
		}

		log.Printf("[currency_sync] %s: compra=%.4f venta=%.4f fecha=%s",
			cot.ISOCode, cot.Compra, cot.Venta, rateDate.Format("2006-01-02"))

		result.Rates = append(result.Rates, SyncedRate{
			ISOCode:  cot.ISOCode,
			RateDate: rateDate,
			BuyRate:  cot.Compra,
			SellRate: cot.Venta,
		})
	}

	if len(result.Rates) == 0 {
		return result, fmt.Errorf("BCU no devolvió ninguna cotización válida")
	}

	// Notificar al ERP para que actualice los schemas de los tenants activos
	if err := pushRatesToERP(result.Rates, fecha); err != nil {
		// No es fatal: las cotizaciones están guardadas en Platform.
		// El ERP las puede pedir cuando las necesite.
		log.Printf("[currency_sync] Advertencia: no se pudo notificar al ERP: %v", err)
		result.ERPSyncWarning = err.Error()
	} else {
		result.ERPSynced = true
	}

	log.Printf("[currency_sync] Completado: %d monedas sincronizadas", len(result.Rates))
	return result, nil
}

// pushRatesToERP llama al endpoint interno del ERP para distribuir las cotizaciones
// a todos los schemas de tenants activos.
func pushRatesToERP(rates []SyncedRate, fecha time.Time) error {
	erpURL := os.Getenv("ERP_INTERNAL_URL")
	if erpURL == "" {
		erpURL = "http://localhost:8080"
	}
	internalKey := os.Getenv("INTERNAL_API_KEY")
	if internalKey == "" {
		internalKey = "innofactu-internal-2026"
	}

	payload := map[string]interface{}{
		"date":  fecha.Format("2006-01-02"),
		"rates": rates,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", erpURL+"/internal/sync-rates", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Key", internalKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("ERP respondió %d", resp.StatusCode)
	}
	return nil
}

func montevideoLoc() *time.Location {
	loc, err := time.LoadLocation("America/Montevideo")
	if err != nil {
		return time.UTC
	}
	return loc
}

// SyncResult es el resultado de una sincronización.
type SyncResult struct {
	SyncedAt       time.Time    `json:"synced_at"`
	Rates          []SyncedRate `json:"rates"`
	ERPSynced      bool         `json:"erp_synced"`
	ERPSyncWarning string       `json:"erp_sync_warning,omitempty"`
}

// SyncedRate es el resumen de una cotización sincronizada.
type SyncedRate struct {
	ISOCode  string    `json:"iso_code"`
	RateDate time.Time `json:"rate_date"`
	BuyRate  float64   `json:"buy_rate"`
	SellRate float64   `json:"sell_rate"`
}
