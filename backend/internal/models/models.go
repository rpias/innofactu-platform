package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Plan representa un plan de suscripción de la plataforma
type Plan struct {
	ID                   uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Code                 string    `json:"code" gorm:"uniqueIndex;not null"`
	Name                 string    `json:"name" gorm:"not null"`
	PriceMonthlyUYU      float64   `json:"price_monthly_uyu"`
	PriceYearlyUYU       float64   `json:"price_yearly_uyu"`
	MaxUsers             int       `json:"max_users"`
	MaxInvoicesPerMonth  int       `json:"max_invoices_per_month"`
	MaxArticles          int       `json:"max_articles"`
	MaxContacts          int       `json:"max_contacts"`
	MaxSucursales        int       `json:"max_sucursales"`
	MaxStorageMB         int       `json:"max_storage_mb"`
	EfacturaEnabled      bool      `json:"efactura_enabled"`
	MultiSucursalEnabled bool      `json:"multi_sucursal_enabled"`
	APIAccessEnabled     bool      `json:"api_access_enabled"`
	WhiteLabelEnabled    bool      `json:"white_label_enabled"`
	AdvancedReports      bool      `json:"advanced_reports_enabled"`
	SupportLevel         string    `json:"support_level"`
	SupportSLAHours      int       `json:"support_sla_hours"`
	IsActive             bool      `json:"is_active" gorm:"default:true"`
	IsPublic             bool      `json:"is_public" gorm:"default:true"`
	SortOrder            int       `json:"sort_order"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// Tenant representa una empresa cliente en la plataforma
type Tenant struct {
	ID                 string     `json:"id" gorm:"type:uuid;primaryKey"`
	Slug               string     `json:"slug" gorm:"uniqueIndex;not null"`
	CompanyName        string     `json:"company_name" gorm:"not null"`
	RUT                string     `json:"rut"`
	PlanID             uint       `json:"plan_id"`
	Plan               Plan       `json:"plan" gorm:"foreignKey:PlanID"`
	Status             string     `json:"status" gorm:"default:'trial'"` // trial, active, suspended, cancelled
	TrialEndsAt        *time.Time `json:"trial_ends_at"`
	DBSchema           string     `json:"db_schema"`
	CustomDomain       string     `json:"custom_domain"`
	Region             string     `json:"region" gorm:"default:'UY'"`
	Timezone           string     `json:"timezone" gorm:"default:'America/Montevideo'"`
	AdminEmail         string     `json:"admin_email"`
	AdminName          string     `json:"admin_name"`
	UsageInvoicesMonth int        `json:"usage_invoices_month"`
	UsageUsers         int        `json:"usage_users"`
	UsageStorageMB     int        `json:"usage_storage_mb"`
	Notes              string     `json:"notes"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (t *Tenant) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}

// PlatformUser representa un usuario administrador de la plataforma InnoFactu
type PlatformUser struct {
	ID           uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	Email        string     `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash string     `json:"-" gorm:"not null"`
	FullName     string     `json:"full_name"`
	Role         string     `json:"role" gorm:"default:'support'"` // super_admin, admin, support, billing, sales
	IsActive     bool       `json:"is_active" gorm:"default:true"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (PlatformUser) TableName() string {
	return "platform_users"
}

// SupportTicket representa un ticket de soporte
type SupportTicket struct {
	ID               uint             `json:"id" gorm:"primaryKey;autoIncrement"`
	TicketNumber     string           `json:"ticket_number" gorm:"uniqueIndex;not null"`
	TenantID         string           `json:"tenant_id"`
	Tenant           Tenant           `json:"tenant" gorm:"foreignKey:TenantID"`
	OpenedByName     string           `json:"opened_by_name"`
	OpenedByEmail    string           `json:"opened_by_email"`
	AssignedToID     *uint            `json:"assigned_to_id"`
	AssignedTo       *PlatformUser    `json:"assigned_to" gorm:"foreignKey:AssignedToID"`
	Title            string           `json:"title" gorm:"not null"`
	Category         string           `json:"category"`
	Priority         string           `json:"priority" gorm:"default:'medium'"` // low, medium, high, critical
	Status           string           `json:"status" gorm:"default:'open'"`     // open, in_progress, waiting, resolved, closed
	SLADeadline      *time.Time       `json:"sla_deadline"`
	FirstResponseAt  *time.Time       `json:"first_response_at"`
	ResolvedAt       *time.Time       `json:"resolved_at"`
	SatisfactionScore *int            `json:"satisfaction_score"`
	Messages         []SupportMessage `json:"messages" gorm:"foreignKey:TicketID"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

// SupportMessage representa un mensaje dentro de un ticket de soporte
type SupportMessage struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	TicketID   uint      `json:"ticket_id"`
	AuthorType string    `json:"author_type"` // customer, agent, system
	AuthorID   *uint     `json:"author_id"`
	AuthorName string    `json:"author_name"`
	Content    string    `json:"content" gorm:"type:text"`
	IsInternal bool      `json:"is_internal"`
	CreatedAt  time.Time `json:"created_at"`
}

// TenantSubscription representa una suscripción de un tenant
type TenantSubscription struct {
	ID              uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	TenantID        string     `json:"tenant_id"`
	PlanID          uint       `json:"plan_id"`
	StartsAt        time.Time  `json:"starts_at"`
	EndsAt          *time.Time `json:"ends_at"`
	BillingCycle    string     `json:"billing_cycle"` // monthly, yearly
	AmountUYU       float64    `json:"amount_uyu"`
	Status          string     `json:"status"` // active, cancelled, expired
	PaymentMethod   string     `json:"payment_method"`
	ExternalSubID   string     `json:"external_sub_id"`
	CancelledAt     *time.Time `json:"cancelled_at"`
	CancelReason    string     `json:"cancel_reason"`
	CreatedAt       time.Time  `json:"created_at"`
}

// TenantUsage representa el uso de un tenant en una fecha específica
type TenantUsage struct {
	ID              uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	TenantID        string    `json:"tenant_id"`
	MetricDate      time.Time `json:"metric_date" gorm:"type:date"`
	InvoicesEmitted int       `json:"invoices_emitted"`
	ActiveUsers     int       `json:"active_users"`
	StorageUsedMB   int       `json:"storage_used_mb"`
	APICalls        int       `json:"api_calls"`
	CreatedAt       time.Time `json:"created_at"`
}

func (TenantUsage) TableName() string {
	return "tenant_usages"
}

// PlatformDGICert almacena el certificado DGI global de la plataforma.
// Se usa para el servicio de consulta de RUT (compartido entre todos los tenants).
// Solo puede haber un registro activo a la vez (ID=1, upsert).
type PlatformDGICert struct {
	ID              uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	CertB64Enc      string     `json:"-" gorm:"type:text"`  // PKCS12 encriptado con AES-256-GCM
	CertPasswordEnc string     `json:"-" gorm:"type:text"`  // Contraseña encriptada
	ExpiresAt       *time.Time `json:"expires_at"`
	SubjectName     string     `json:"subject_name"`
	SubjectRUT      string     `json:"subject_rut"`
	UploadedAt      time.Time  `json:"uploaded_at"`
	UploadedBy      string     `json:"uploaded_by"` // email del admin
	UpdatedAt       time.Time  `json:"updated_at"`
}
