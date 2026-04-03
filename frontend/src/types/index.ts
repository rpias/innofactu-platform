export interface Plan {
  id: number
  code: string
  name: string
  price_monthly_uyu: number
  price_yearly_uyu: number
  max_users: number
  max_invoices_per_month: number
  max_articles: number
  max_contacts: number
  max_sucursales: number
  max_storage_mb: number
  efactura_enabled: boolean
  multi_sucursal_enabled: boolean
  api_access_enabled: boolean
  white_label_enabled: boolean
  advanced_reports_enabled: boolean
  support_level: string
  support_sla_hours: number
  is_active: boolean
  is_public: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  slug: string
  company_name: string
  rut: string
  plan_id: number
  plan: Plan
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  db_schema: string
  custom_domain: string
  region: string
  timezone: string
  admin_email: string
  admin_name: string
  usage_invoices_month: number
  usage_users: number
  usage_storage_mb: number
  notes: string
  created_at: string
  updated_at: string
}

export interface PlatformUser {
  id: number
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'support' | 'billing' | 'sales'
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface SupportMessage {
  id: number
  ticket_id: number
  author_type: 'customer' | 'agent' | 'system'
  author_id: number | null
  author_name: string
  content: string
  is_internal: boolean
  created_at: string
}

export interface SupportTicket {
  id: number
  ticket_number: string
  tenant_id: string
  tenant: Tenant
  opened_by_name: string
  opened_by_email: string
  assigned_to_id: number | null
  assigned_to: PlatformUser | null
  title: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  sla_deadline: string | null
  first_response_at: string | null
  resolved_at: string | null
  satisfaction_score: number | null
  messages: SupportMessage[]
  created_at: string
  updated_at: string
}

export interface TenantStats {
  total: number
  trial: number
  active: number
  suspended: number
  cancelled: number
}

export interface TicketStats {
  open: number
  in_progress: number
  resolved: number
  avg_csat: number
}

export interface DashboardStats {
  total_tenants: number
  active_tenants: number
  trial_tenants: number
  open_tickets: number
  critical_tickets: number
  mrr_estimate: number
  recent_tenants: Tenant[]
  critical_tickets_list: SupportTicket[]
}

export interface TenantSubscription {
  id: number
  tenant_id: string
  plan_id: number
  starts_at: string
  ends_at: string | null
  billing_cycle: 'monthly' | 'yearly'
  amount_uyu: number
  status: string
  payment_method: string
  external_sub_id: string
  cancelled_at: string | null
  cancel_reason: string
  created_at: string
}

export interface LoginResponse {
  token: string
  user: PlatformUser
}

export interface CertStatus {
  has_cert: boolean
  expiry_date?: string
  days_until_expiry: number
  expiry_status: 'none' | 'ok' | 'warning' | 'critical' | 'expired'
  subject_rut?: string
  subject_name?: string
  serial?: string
  uploaded_at?: string
  uploaded_by?: string
}

export interface CertHistoryEntry {
  ID: number
  CreatedAt: string
  uploaded_at: string
  uploaded_by: string
  uploaded_source: 'tenant' | 'platform'
  cert_expiry?: string
  cert_subject_rut?: string
  cert_serial?: string
  notes?: string
}
