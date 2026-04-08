package controllers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"time"

	"platform/internal/database"
	"platform/internal/models"

	"github.com/go-chi/chi/v5"
	"software.sslmate.com/src/go-pkcs12"
)

// certEncryptionKey devuelve la clave AES-256 de 32 bytes desde CERT_ENCRYPTION_KEY (hex o raw).
func certEncryptionKey() ([]byte, error) {
	keyHex := os.Getenv("CERT_ENCRYPTION_KEY")
	if keyHex == "" {
		return nil, errors.New("CERT_ENCRYPTION_KEY no configurada")
	}
	// Intentar decodificar como hex (64 chars → 32 bytes)
	if len(keyHex) == 64 {
		key := make([]byte, 32)
		for i := 0; i < 32; i++ {
			var b byte
			hi := keyHex[i*2]
			lo := keyHex[i*2+1]
			hi = hexNibble(hi)
			lo = hexNibble(lo)
			b = (hi << 4) | lo
			key[i] = b
		}
		return key, nil
	}
	// Si tiene 32 bytes en raw, usarlo directo
	raw := []byte(keyHex)
	if len(raw) == 32 {
		return raw, nil
	}
	return nil, errors.New("CERT_ENCRYPTION_KEY debe ser 64 caracteres hex o 32 bytes raw")
}

func hexNibble(c byte) byte {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}

// encryptAESGCM encripta plaintext con AES-256-GCM y devuelve base64(nonce+ciphertext).
func encryptAESGCM(key, plaintext []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptAESGCM decripta un valor producido por encryptAESGCM.
func decryptAESGCM(key []byte, b64data string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(b64data)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, errors.New("ciphertext demasiado corto")
	}
	nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// PlatformCertRoutes monta las rutas de gestión del certificado DGI.
func PlatformCertRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(AuthRequired)
	r.Get("/", GetPlatformDGICert)
	r.Post("/", UploadPlatformDGICert)
	r.Delete("/", DeletePlatformDGICert)
	return r
}

// certMetaResponse es la respuesta pública de metadata del certificado.
type certMetaResponse struct {
	ID          uint       `json:"id"`
	ExpiresAt   *time.Time `json:"expires_at"`
	SubjectName string     `json:"subject_name"`
	SubjectRUT  string     `json:"subject_rut"`
	UploadedAt  time.Time  `json:"uploaded_at"`
	UploadedBy  string     `json:"uploaded_by"`
	DaysLeft    int        `json:"days_left"`
	Status      string     `json:"status"` // "ok", "expiring_soon", "expired", "unknown"
}

func buildCertMeta(cert *models.PlatformDGICert) certMetaResponse {
	meta := certMetaResponse{
		ID:          cert.ID,
		ExpiresAt:   cert.ExpiresAt,
		SubjectName: cert.SubjectName,
		SubjectRUT:  cert.SubjectRUT,
		UploadedAt:  cert.UploadedAt,
		UploadedBy:  cert.UploadedBy,
	}
	if cert.ExpiresAt != nil {
		daysLeft := int(time.Until(*cert.ExpiresAt).Hours() / 24)
		meta.DaysLeft = daysLeft
		switch {
		case daysLeft < 0:
			meta.Status = "expired"
		case daysLeft < 30:
			meta.Status = "expiring_soon"
		default:
			meta.Status = "ok"
		}
	} else {
		meta.Status = "unknown"
	}
	return meta
}

// GetPlatformDGICert devuelve la metadata del certificado DGI global.
// GET /api/platform/dgi-cert
func GetPlatformDGICert(w http.ResponseWriter, r *http.Request) {
	var cert models.PlatformDGICert
	if err := database.DB.First(&cert).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"configured": false})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(buildCertMeta(&cert))
}

// UploadPlatformDGICert sube o reemplaza el certificado DGI global.
// POST /api/platform/dgi-cert  (multipart: file=.pfx, password=string)
func UploadPlatformDGICert(w http.ResponseWriter, r *http.Request) {
	// Obtener usuario autenticado
	uploaderEmail := ""
	if email, ok := r.Context().Value(contextKey("user_email")).(string); ok {
		uploaderEmail = email
	}

	// Parsear multipart (máx 10 MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"error":"Error parseando formulario"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"Campo 'file' requerido"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	pfxBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, `{"error":"Error leyendo archivo"}`, http.StatusInternalServerError)
		return
	}

	password := r.FormValue("password")

	// Parsear el PFX para validar y extraer metadata
	_, cert, err := pkcs12.Decode(pfxBytes, password)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error parseando PFX: " + err.Error()})
		return
	}

	expiresAt := cert.NotAfter
	subjectName := cert.Subject.CommonName
	subjectRUT := ""
	// Intentar extraer RUT del SerialNumber o de los campos del Subject
	if cert.Subject.SerialNumber != "" {
		subjectRUT = cert.Subject.SerialNumber
	}

	// Encriptar cert y contraseña
	key, err := certEncryptionKey()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	certB64Raw := base64.StdEncoding.EncodeToString(pfxBytes)
	certB64Enc, err := encryptAESGCM(key, []byte(certB64Raw))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error encriptando certificado"})
		return
	}

	certPasswordEnc, err := encryptAESGCM(key, []byte(password))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error encriptando contraseña"})
		return
	}

	now := time.Now()

	// Upsert: eliminar existente y crear nuevo con ID=1
	database.DB.Delete(&models.PlatformDGICert{}, "1 = 1")

	record := models.PlatformDGICert{
		ID:              1,
		CertB64Enc:      certB64Enc,
		CertPasswordEnc: certPasswordEnc,
		ExpiresAt:       &expiresAt,
		SubjectName:     subjectName,
		SubjectRUT:      subjectRUT,
		UploadedAt:      now,
		UploadedBy:      uploaderEmail,
		UpdatedAt:       now,
	}

	if err := database.DB.Create(&record).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error guardando certificado"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(buildCertMeta(&record))
}

// DeletePlatformDGICert elimina el certificado DGI global.
// DELETE /api/platform/dgi-cert
func DeletePlatformDGICert(w http.ResponseWriter, r *http.Request) {
	result := database.DB.Delete(&models.PlatformDGICert{}, "1 = 1")
	if result.Error != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error eliminando certificado"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":      true,
		"deleted": result.RowsAffected,
	})
}

// GetInternalDGICert devuelve el cert desencriptado para uso interno del ERP.
// GET /internal/dgi-cert   (protegido con X-Internal-Key via InternalRatesAuth)
func GetInternalDGICert(w http.ResponseWriter, r *http.Request) {
	var cert models.PlatformDGICert
	if err := database.DB.First(&cert).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "No hay certificado DGI configurado"})
		return
	}

	key, err := certEncryptionKey()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	certB64RawBytes, err := decryptAESGCM(key, cert.CertB64Enc)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error desencriptando certificado"})
		return
	}

	passwordBytes, err := decryptAESGCM(key, cert.CertPasswordEnc)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error desencriptando contraseña"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"cert_b64":   string(certB64RawBytes),
		"password":   string(passwordBytes),
		"expires_at": cert.ExpiresAt,
	})
}
