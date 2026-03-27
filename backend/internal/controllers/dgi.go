package controllers

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"

	"platform/internal/utils"
)

var (
	dgiClientOnce   sync.Once
	dgiClientGlobal *utils.DGIClient
	dgiClientErr    error
)

func getDGIClient() (*utils.DGIClient, error) {
	dgiClientOnce.Do(func() {
		if b64 := os.Getenv("DGI_CERT_B64"); b64 != "" {
			dgiClientGlobal, dgiClientErr = utils.NewDGIClientFromBase64(b64, os.Getenv("DGI_CERT_PASSWORD"))
		} else if path := os.Getenv("DGI_CERT_PATH"); path != "" {
			dgiClientGlobal, dgiClientErr = utils.NewDGIClientFromFile(path, os.Getenv("DGI_CERT_PASSWORD"))
		}
	})
	return dgiClientGlobal, dgiClientErr
}

// GET /api/dgi/rut?rut=219449530012
func ConsultarRUT(w http.ResponseWriter, r *http.Request) {
	rut := r.URL.Query().Get("rut")
	if rut == "" {
		http.Error(w, `{"error":"parámetro rut requerido"}`, http.StatusBadRequest)
		return
	}

	if !utils.ValidateRUT(rut) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]string{"error": "RUT inválido (dígito verificador incorrecto)"})
		return
	}

	client, err := getDGIClient()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error cargando certificado DGI: " + err.Error()})
		return
	}
	if client == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "Integración DGI no configurada"})
		return
	}

	empresa, err := client.ConsultarRUT(rut)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(empresa)
}
