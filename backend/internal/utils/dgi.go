package utils

// DGI Uruguay — CVA Web Service client
// Authentication: WS-Security 1.1 with XML Digital Signature (RSA-SHA1)
// Endpoint: https://serviciosdp.dgi.gub.uy:6491/CVA_WS/servlet/acva_ws

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1" //nolint:gosec — required by DGI WS spec
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"software.sslmate.com/src/go-pkcs12"
)

// DGIClient holds the certificate and private key for signing SOAP requests
type DGIClient struct {
	privateKey *rsa.PrivateKey
	certB64    string // base64-encoded DER certificate (for WS-Security header)
}

// DGIEmpresa holds company data returned from DGI
type DGIEmpresa struct {
	RUT               string `json:"rut"`
	Denominacion      string `json:"denominacion"`
	DomicilioFiscal   string `json:"domicilio_fiscal"`
	TipoContribuyente string `json:"tipo_contribuyente"`
	Estado            string `json:"estado"`
	Emision           string `json:"emision"`
	Vencimiento       string `json:"vencimiento"`
}

// NewDGIClientFromFile loads a PKCS12 (.pfx) certificate from disk
func NewDGIClientFromFile(pfxPath, password string) (*DGIClient, error) {
	data, err := os.ReadFile(pfxPath)
	if err != nil {
		return nil, fmt.Errorf("leyendo certificado: %w", err)
	}
	return newDGIClient(data, password)
}

// NewDGIClientFromBase64 loads a PKCS12 certificate from a base64 string (for env vars)
func NewDGIClientFromBase64(pfxB64, password string) (*DGIClient, error) {
	data, err := base64.StdEncoding.DecodeString(pfxB64)
	if err != nil {
		return nil, fmt.Errorf("decodificando certificado base64: %w", err)
	}
	return newDGIClient(data, password)
}

func newDGIClient(pfxData []byte, password string) (*DGIClient, error) {
	pk, cert, err := pkcs12.Decode(pfxData, password)
	if err != nil {
		return nil, fmt.Errorf("decodificando PFX: %w", err)
	}
	rsaKey, ok := pk.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("la clave privada no es RSA")
	}
	return &DGIClient{
		privateKey: rsaKey,
		certB64:    base64.StdEncoding.EncodeToString(cert.Raw),
	}, nil
}

// ConsultarRUT queries the DGI CVA service for company data by RUT (12 digits)
func (c *DGIClient) ConsultarRUT(rut string) (*DGIEmpresa, error) {
	rut = strings.ReplaceAll(rut, "-", "")
	rut = strings.ReplaceAll(rut, ".", "")
	rut = strings.TrimSpace(rut)

	// Unique ID for the SOAP body element (used in the XML Signature reference)
	bodyID := fmt.Sprintf("body-%d", time.Now().UnixNano())

	// ── Step 1: Canonical body (Exclusive C14N, exc-c14n#) ────────────────────
	// xmlns:soapenv and xmlns:wsu are visibly utilized on Body (element name + wsu:Id attr).
	// xmlns:cva is NOT visibly utilized on Body — only on the child cva:CVA_WS.Execute.
	// In exc-c14n, each namespace is rendered on the first element in the subtree
	// where it is visibly utilized, not hoisted to an ancestor.
	canonBody := fmt.Sprintf(
		`<soapenv:Body xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="%s"><cva:CVA_WS.Execute xmlns:cva="CVA_FE"><cva:Ruc>%s</cva:Ruc></cva:CVA_WS.Execute></soapenv:Body>`,
		bodyID, rut,
	)

	// ── Step 2: SHA-1 digest of the canonical body (DGI example uses SHA1) ───
	//nolint:gosec — DGI CVA WS requires SHA1 as per their spec example
	bodyHashBytes := sha1.Sum([]byte(canonBody))
	bodyDigest := base64.StdEncoding.EncodeToString(bodyHashBytes[:])

	// ── Step 3: Canonical SignedInfo ──────────────────────────────────────────
	// CanonicalizationMethod has InclusiveNamespaces PrefixList="cva soapenv":
	// this means when the verifier canonicalizes SignedInfo with exc-c14n, it
	// includes cva and soapenv namespace declarations even though they're only
	// from ancestor context (Envelope). We must sign the same canonical form.
	// In C14N, empty elements use open+close tags (not self-closing />)
	// Use SHA1 algorithms as per DGI example (rsa-sha1 + sha1 digest)
	canonSignedInfo := fmt.Sprintf(
		`<ds:SignedInfo xmlns:cva="CVA_FE" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">`+
			`<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">`+
			`<ec:InclusiveNamespaces xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList="cva soapenv"></ec:InclusiveNamespaces>`+
			`</ds:CanonicalizationMethod>`+
			`<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod>`+
			`<ds:Reference URI="#%s">`+
			`<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform></ds:Transforms>`+
			`<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod>`+
			`<ds:DigestValue>%s</ds:DigestValue>`+
			`</ds:Reference>`+
			`</ds:SignedInfo>`,
		bodyID, bodyDigest,
	)

	// ── Step 4: RSA-SHA1 signature over canonical SignedInfo ──────────────────
	//nolint:gosec — DGI WS spec uses SHA1
	siHashBytes := sha1.Sum([]byte(canonSignedInfo))
	sigBytes, err := rsa.SignPKCS1v15(rand.Reader, c.privateKey, crypto.SHA1, siHashBytes[:])
	if err != nil {
		return nil, fmt.Errorf("firmando: %w", err)
	}
	sigB64 := base64.StdEncoding.EncodeToString(sigBytes)

	// ── Step 5: Build complete SOAP envelope ──────────────────────────────────
	// WS-Security with BinarySecurityToken (recommended by DGI docs for SOAPUI)
	bstID := fmt.Sprintf("bst-%d", time.Now().UnixNano())
	envelope := fmt.Sprintf(
		`<?xml version="1.0" encoding="UTF-8"?>`+
			`<soapenv:Envelope xmlns:cva="CVA_FE" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">`+
			`<soapenv:Header>`+
			`<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">`+
			`<wsse:BinarySecurityToken wsu:Id="%s" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">%s</wsse:BinarySecurityToken>`+
			`<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`+
			`%s`+ // canonSignedInfo
			`<ds:SignatureValue>%s</ds:SignatureValue>`+
			`<ds:KeyInfo>`+
			`<wsse:SecurityTokenReference>`+
			`<wsse:Reference URI="#%s" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>`+
			`</wsse:SecurityTokenReference>`+
			`</ds:KeyInfo>`+
			`</ds:Signature>`+
			`</wsse:Security>`+
			`</soapenv:Header>`+
			`<soapenv:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="%s">`+
			`<cva:CVA_WS.Execute><cva:Ruc>%s</cva:Ruc></cva:CVA_WS.Execute>`+
			`</soapenv:Body>`+
			`</soapenv:Envelope>`,
		bstID, c.certB64, canonSignedInfo, sigB64, bstID, bodyID, rut,
	)

	// ── Step 6: Send to DGI ───────────────────────────────────────────────────
	// DGI uses a custom CA on port 6491, so we skip TLS verification
	// (WS-Security message signing provides end-to-end authentication)
	httpClient := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
		},
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest("POST",
		"https://serviciosdp.dgi.gub.uy:6491/CVA_WS/servlet/acva_ws",
		strings.NewReader(envelope),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPAction", `"CVA_FEaction/ACVA_WS.Execute"`)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error conectando a DGI: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return parseDGIResponse(string(body))
}

// ValidateRUT validates the check digit of a Uruguayan RUT (12 digits)
// Algorithm: weights [4,3,2,9,8,7,6,5,4,3,2] on first 11 digits, mod 11
func ValidateRUT(rut string) bool {
	rut = strings.ReplaceAll(rut, "-", "")
	rut = strings.ReplaceAll(rut, ".", "")
	rut = strings.TrimSpace(rut)
	if len(rut) != 12 {
		return false
	}
	weights := []int{4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	sum := 0
	for i := 0; i < 11; i++ {
		d := int(rut[i] - '0')
		if d < 0 || d > 9 {
			return false
		}
		sum += d * weights[i]
	}
	rem := sum % 11
	var check int
	switch rem {
	case 0:
		check = 1
	case 1:
		check = 0
	default:
		check = 11 - rem
	}
	return int(rut[11]-'0') == check
}

// parseDGIResponse parses the SOAP XML response from DGI CVA service
func parseDGIResponse(xmlStr string) (*DGIEmpresa, error) {
	// Check for SOAP fault (e.g. signature error, malformed request)
	if strings.Contains(xmlStr, "faultstring") {
		msg := extractXMLValue(xmlStr, "faultstring")
		return nil, fmt.Errorf("DGI SOAP fault: %s", msg)
	}

	// Check for application-level error flag
	flag := extractXMLValue(xmlStr, "Flag")
	if flag != "" && flag != "OK" {
		errMsg := extractXMLValue(xmlStr, "Error")
		return nil, fmt.Errorf("DGI error: %s", errMsg)
	}

	// Check RUT not found
	if !strings.Contains(xmlStr, "Denominacion") {
		return nil, fmt.Errorf("RUT no encontrado en DGI")
	}

	return &DGIEmpresa{
		RUT:               extractXMLValue(xmlStr, "RUT"),
		Denominacion:      extractXMLValue(xmlStr, "Denominacion"),
		DomicilioFiscal:   extractXMLValue(xmlStr, "DomicilioFiscal"),
		TipoContribuyente: extractXMLValue(xmlStr, "TipoContribuyente"),
		Estado:            extractXMLValue(xmlStr, "Estado"),
		Emision:           extractXMLValue(xmlStr, "Emision"),
		Vencimiento:       extractXMLValue(xmlStr, "Vencimiento"),
	}, nil
}

// extractXMLValue extracts the text content of the first occurrence of a tag
func extractXMLValue(xml, tag string) string {
	open := "<" + tag + ">"
	close := "</" + tag + ">"
	start := strings.Index(xml, open)
	if start == -1 {
		return ""
	}
	start += len(open)
	end := strings.Index(xml[start:], close)
	if end == -1 {
		return ""
	}
	return strings.TrimSpace(xml[start : start+end])
}
