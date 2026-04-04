package models

import "time"

// ExchangeRate almacena la cotización diaria de una moneda obtenida del BCU.
// Esta tabla es compartida entre todos los tenants — un solo registro por
// moneda/fecha, independientemente de cuántos tenants haya.
type ExchangeRate struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	ISOCode  string    `json:"iso_code" gorm:"not null;index:idx_rate_date,unique,priority:1"`
	RateDate time.Time `json:"rate_date" gorm:"not null;index:idx_rate_date,unique,priority:2;type:date"`
	BuyRate  float64   `json:"buy_rate" gorm:"not null"`
	SellRate float64   `json:"sell_rate" gorm:"not null"`
	Source   string    `json:"source" gorm:"not null;default:'BCU'"` // BCU | manual
	SyncedAt time.Time `json:"synced_at"`                              // cuándo se consultó al BCU
}
