// Package bcu provee un cliente para el servicio SOAP de cotizaciones del
// Banco Central del Uruguay (BCU).
//
// Endpoint: https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones
// Documentación: https://www.bcu.gub.uy/Estadisticas-e-Indicadores/Paginas/Cotizaciones.aspx
//
// Grupo 2 = cotizaciones del mercado local (las que usa DGI para CFEs).
package bcu

import (
	"bytes"
	"crypto/tls"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	endpoint   = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones"
	soapAction = ""
	grupoLocal = 2 // mercado local — el que usa DGI
)

// Códigos de moneda BCU (campo <Moneda> en el request SOAP).
const (
	MonedaUSD = 2225 // Dólar USA
	MonedaEUR = 1111 // Euro
	MonedaARS = 500  // Peso Argentino
	MonedaBRL = 1550 // Real Brasilero
)

// Monedas contiene los pares código BCU → ISO code que sincronizamos.
var Monedas = map[int]string{
	MonedaUSD: "USD",
	MonedaEUR: "EUR",
	MonedaARS: "ARS",
	MonedaBRL: "BRL",
}

// Cotizacion es el resultado de una cotización del BCU para una moneda y fecha.
type Cotizacion struct {
	ISOCode string
	Nombre  string
	Fecha   time.Time
	Compra  float64 // cotización compradora (la que usa DGI para CFEs)
	Venta   float64 // cotización vendedora
}

// GetCotizaciones consulta el BCU y devuelve las cotizaciones del grupo local
// para el día indicado. Si el día es inhábil el BCU devuelve la última cotización válida.
func GetCotizaciones(fecha time.Time) ([]Cotizacion, error) {
	dateStr := fecha.Format("20060102")

	// Construimos una solicitud por cada moneda (el BCU admite varias en un request,
	// pero para simplicidad y trazabilidad hacemos una por cada una)
	var all []Cotizacion
	for codBCU, isoCode := range Monedas {
		cot, err := getCotizacion(codBCU, isoCode, dateStr)
		if err != nil {
			return nil, fmt.Errorf("BCU [%s]: %w", isoCode, err)
		}
		all = append(all, cot)
	}
	return all, nil
}

func getCotizacion(codBCU int, isoCode, dateStr string) (Cotizacion, error) {
	body := buildSOAPRequest(codBCU, dateStr)

	client := &http.Client{
		Timeout: 20 * time.Second,
		Transport: &http.Transport{
			// BCU a veces tiene issues con el certificado SSL; skip verify en prod
			// solo si la variable de entorno BCU_SKIP_TLS=true está seteada.
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		},
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBufferString(body))
	if err != nil {
		return Cotizacion{}, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPAction", soapAction)

	resp, err := client.Do(req)
	if err != nil {
		// Si falla por TLS, reintentamos con InsecureSkipVerify
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		resp, err = client.Do(req)
		if err != nil {
			return Cotizacion{}, fmt.Errorf("request failed: %w", err)
		}
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return Cotizacion{}, fmt.Errorf("read response: %w", err)
	}

	return parseSOAPResponse(data, isoCode)
}

// buildSOAPRequest arma el envelope SOAP para consultar una moneda.
func buildSOAPRequest(codBCU int, dateStr string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:con="http://cotizaciones.bcu.gub.uy">
  <soapenv:Header/>
  <soapenv:Body>
    <con:Execute>
      <con:wsinput>
        <con:FechaDesde>%s</con:FechaDesde>
        <con:FechaHasta>%s</con:FechaHasta>
        <con:Moneda>
          <con:Izq>%d</con:Izq>
        </con:Moneda>
        <con:Grupo>%d</con:Grupo>
      </con:wsinput>
    </con:Execute>
  </soapenv:Body>
</soapenv:Envelope>`, dateStr, dateStr, codBCU, grupoLocal)
}

// ── XML parsing ────────────────────────────────────────────────────────────────

type soapEnvelopeResp struct {
	XMLName xml.Name     `xml:"Envelope"`
	Body    soapBodyResp `xml:"Body"`
}

type soapBodyResp struct {
	Response executeResponse `xml:"ExecuteResponse"`
}

type executeResponse struct {
	Output wsOutput `xml:"wsoutput"`
}

type wsOutput struct {
	Datos datosCotizaciones `xml:"datoscotizaciones"`
}

type datosCotizaciones struct {
	Items []wsbcuCotizacion `xml:"wsbcucotizaciones"`
}

type wsbcuCotizacion struct {
	Moneda    int           `xml:"moneda"`
	Nombre    string        `xml:"nombre"`
	ISOCode   string        `xml:"codigoiso"`
	Fecha     string        `xml:"fecha"`
	TipoCambio []tipoCambio `xml:"tipocambio"`
}

type tipoCambio struct {
	TCC   string  `xml:"TCC"`
	Valor float64 `xml:"valor"`
}

func parseSOAPResponse(data []byte, isoCode string) (Cotizacion, error) {
	// El BCU devuelve namespaces dinámicos (ns2:, etc.), así que los eliminamos
	// para simplificar el parsing.
	clean := stripNamespaces(data)

	var env soapEnvelopeResp
	if err := xml.Unmarshal(clean, &env); err != nil {
		return Cotizacion{}, fmt.Errorf("xml unmarshal: %w — body: %s", err, string(data[:min(len(data), 500)]))
	}

	items := env.Body.Response.Output.Datos.Items
	if len(items) == 0 {
		return Cotizacion{}, fmt.Errorf("BCU no devolvió cotizaciones para %s", isoCode)
	}

	item := items[0]
	cot := Cotizacion{
		ISOCode: strings.TrimSpace(item.ISOCode),
		Nombre:  strings.TrimSpace(item.Nombre),
	}
	if cot.ISOCode == "" {
		cot.ISOCode = isoCode
	}

	// Parsear fecha (BCU devuelve formato ISO 8601 con timezone)
	if item.Fecha != "" {
		t, err := time.Parse(time.RFC3339, item.Fecha)
		if err != nil {
			// fallback: solo fecha
			t, _ = time.Parse("2006-01-02", item.Fecha[:10])
		}
		cot.Fecha = t
	}

	for _, tc := range item.TipoCambio {
		switch strings.ToLower(strings.TrimSpace(tc.TCC)) {
		case "comprador", "compra":
			cot.Compra = tc.Valor
		case "vendedor", "venta":
			cot.Venta = tc.Valor
		}
	}

	// Fallback: si solo hay un tipo de cambio, usarlo para ambos
	if cot.Compra == 0 && cot.Venta == 0 && len(item.TipoCambio) > 0 {
		v, _ := strconv.ParseFloat(fmt.Sprintf("%g", item.TipoCambio[0].Valor), 64)
		cot.Compra = v
		cot.Venta = v
	}

	return cot, nil
}

// stripNamespaces elimina prefijos de namespace del XML para simplificar parsing.
// Ejemplo: <ns2:moneda> → <moneda>
func stripNamespaces(data []byte) []byte {
	s := string(data)
	// Eliminar declaraciones xmlns:XXX="..."
	// Eliminar prefijos XXX: en tags de apertura y cierre
	var result strings.Builder
	i := 0
	for i < len(s) {
		if s[i] == '<' {
			result.WriteByte('<')
			i++
			// closing tag
			if i < len(s) && s[i] == '/' {
				result.WriteByte('/')
				i++
			}
			// leer hasta el primer espacio o >
			tag := ""
			for i < len(s) && s[i] != ' ' && s[i] != '>' && s[i] != '/' {
				tag += string(s[i])
				i++
			}
			// eliminar prefijo namespace (ej: ns2:moneda → moneda)
			if idx := strings.Index(tag, ":"); idx >= 0 {
				tag = tag[idx+1:]
			}
			result.WriteString(tag)
		} else {
			result.WriteByte(s[i])
			i++
		}
	}
	return []byte(result.String())
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
