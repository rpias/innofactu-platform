import axios from 'axios'
import type {
  LoginResponse,
  PlatformUser,
  Plan,
  Tenant,
  SupportTicket,
  SupportMessage,
  TenantStats,
  TicketStats,
  DashboardStats,
  CertStatus,
  CertHistoryEntry,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// Interceptor: añadir token Bearer
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: redirigir a login en 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platform_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const auth = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  getMe: (): Promise<PlatformUser> =>
    api.get('/auth/me').then((r) => r.data),
}

// Plans
export const plans = {
  getAll: (): Promise<Plan[]> =>
    api.get('/plans').then((r) => r.data),

  getOne: (id: number): Promise<Plan> =>
    api.get(`/plans/${id}`).then((r) => r.data),

  create: (data: Partial<Plan>): Promise<Plan> =>
    api.post('/plans', data).then((r) => r.data),

  update: (id: number, data: Partial<Plan>): Promise<Plan> =>
    api.put(`/plans/${id}`, data).then((r) => r.data),
}

// Tenants
export const tenants = {
  getAll: (params?: { q?: string; status?: string; plan_id?: number }): Promise<Tenant[]> =>
    api.get('/tenants', { params }).then((r) => r.data),

  getOne: (id: string): Promise<Tenant> =>
    api.get(`/tenants/${id}`).then((r) => r.data),

  create: (data: Partial<Tenant>): Promise<{ tenant: Tenant; admin_credentials?: { email: string; password: string; note: string } }> =>
    api.post('/tenants', data).then((r) => r.data),

  update: (id: string, data: Partial<Tenant>): Promise<Tenant> =>
    api.put(`/tenants/${id}`, data).then((r) => r.data),

  suspend: (id: string): Promise<{ message: string }> =>
    api.post(`/tenants/${id}/suspend`).then((r) => r.data),

  reactivate: (id: string): Promise<{ message: string }> =>
    api.post(`/tenants/${id}/reactivate`).then((r) => r.data),

  getStats: (): Promise<TenantStats> =>
    api.get('/tenants/stats').then((r) => r.data),

  resetAdminPassword: (id: string): Promise<{ email: string; password: string; note: string }> =>
    api.post(`/tenants/${id}/reset-admin-password`).then((r) => r.data),

  getCertStatus: (id: string): Promise<CertStatus> =>
    api.get(`/tenants/${id}/cert`).then((r) => r.data),

  uploadCert: (id: string, file: File, password: string, notes?: string): Promise<CertStatus> => {
    const form = new FormData()
    form.append('cert', file)
    form.append('password', password)
    if (notes) form.append('notes', notes)
    return api.post(`/tenants/${id}/cert`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  getCertHistory: (id: string): Promise<CertHistoryEntry[]> =>
    api.get(`/tenants/${id}/cert/history`).then((r) => r.data),
}

// Support
export const support = {
  getTickets: (params?: {
    status?: string
    priority?: string
    tenant_id?: string
    assigned_to?: string
  }): Promise<SupportTicket[]> =>
    api.get('/support', { params }).then((r) => r.data),

  getTicket: (id: number): Promise<SupportTicket> =>
    api.get(`/support/${id}`).then((r) => r.data),

  create: (data: Partial<SupportTicket>): Promise<SupportTicket> =>
    api.post('/support', data).then((r) => r.data),

  update: (
    id: number,
    data: { status?: string; priority?: string; assigned_to_id?: number }
  ): Promise<SupportTicket> =>
    api.put(`/support/${id}`, data).then((r) => r.data),

  addMessage: (
    ticketId: number,
    data: { content: string; author_type: string; author_name: string; is_internal: boolean }
  ): Promise<SupportMessage> =>
    api.post(`/support/${ticketId}/messages`, data).then((r) => r.data),

  rate: (id: number, score: number): Promise<{ message: string }> =>
    api.post(`/support/${id}/rate`, { score }).then((r) => r.data),

  getStats: (): Promise<TicketStats> =>
    api.get('/support/stats').then((r) => r.data),
}

// Dashboard
export const dashboard = {
  get: (): Promise<DashboardStats> =>
    api.get('/dashboard').then((r) => r.data),
}

export default api
