import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Copy, Plus, Search, XCircle } from 'lucide-react'
import { tenants as tenantsApi, plans as plansApi } from '../services/api'
import type { Tenant, Plan } from '../types'

/**
 * Validación de RUT uruguayo — algoritmo módulo 11 DGI.
 * Pesos aplicados de derecha a izquierda sobre los dígitos sin el verificador: 2,9,8,7,6,3,4,5 (cíclico).
 * Dígito verificador = (11 - (suma % 11)) % 11. Si el resultado es 10 → RUT inválido.
 */
function validateRUT(raw: string): { valid: boolean; error?: string } {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return { valid: true } // opcional, sin error si vacío
  if (digits.length < 7 || digits.length > 12)
    return { valid: false, error: 'El RUT debe tener entre 7 y 12 dígitos' }

  const checkDigit = parseInt(digits[digits.length - 1])
  const body = digits.slice(0, -1)
  const weights = [2, 9, 8, 7, 6, 3, 4, 5]

  let sum = 0
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * weights[(body.length - 1 - i) % weights.length]
  }

  const remainder = sum % 11
  if (remainder === 1) return { valid: false, error: 'RUT inválido (dígito verificador incorrecto)' }
  const computed = remainder === 0 ? 0 : 11 - remainder

  if (computed !== checkDigit)
    return { valid: false, error: `Dígito verificador incorrecto (esperado: ${computed})` }

  return { valid: true }
}

/** Formatea RUT mientras el usuario escribe: solo dígitos, máx 12, agrega guión antes del último dígito. */
function formatRUT(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12)
  if (digits.length <= 1) return digits
  return digits.slice(0, -1) + '-' + digits.slice(-1)
}

const STATUS_BADGE: Record<string, string> = {
  trial: 'badge-yellow',
  active: 'badge-green',
  suspended: 'badge-red',
  cancelled: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  trial: 'Trial',
  active: 'Activo',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days}d`
}

export default function Tenants() {
  const [list, setList] = useState<Tenant[]>([])
  const [planList, setPlanList] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const data = await tenantsApi.getAll({ q, status: statusFilter || undefined })
      setList(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    plansApi.getAll().then(setPlanList)
  }, [])

  useEffect(() => {
    load()
  }, [q, statusFilter])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>Empresas</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Nueva empresa
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Buscar empresa, slug, email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos los estados</option>
          <option value="trial">Trial</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Slug</th>
                <th>Empresa</th>
                <th>RUT</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Usuarios</th>
                <th>Facturas/mes</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Cargando...</td></tr>
              )}
              {!loading && list.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin resultados</td></tr>
              )}
              {!loading && list.map((t) => (
                <tr
                  key={t.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/tenants/${t.id}`)}
                >
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#818cf8' }}>{t.slug}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.company_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.rut || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.plan?.name ?? '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.usage_users}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.usage_invoices_month}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva empresa */}
      {showModal && (
        <NewTenantModal
          plans={planList}
          onClose={() => setShowModal(false)}
          onCreated={() => { load() }}
        />
      )}
    </div>
  )
}

interface AdminCredentials {
  email: string
  password: string
  note: string
}

function NewTenantModal({
  plans,
  onClose,
  onCreated,
}: {
  plans: Plan[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<{
    company_name: string
    rut: string
    slug: string
    admin_email: string
    admin_name: string
    plan_id: number
    status: 'trial' | 'active'
  }>({
    company_name: '',
    rut: '',
    slug: '',
    admin_email: '',
    admin_name: '',
    plan_id: plans[0]?.id ?? 1,
    status: 'trial',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rutError, setRutError] = useState('')
  const [rutValid, setRutValid] = useState(false)
  const [credentials, setCredentials] = useState<AdminCredentials | null>(null)
  const [copied, setCopied] = useState(false)
  const pwRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  // Auto-generar slug desde nombre empresa
  const handleNameChange = (v: string) => {
    set('company_name', v)
    const slug = v.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    set('slug', slug)
  }

  const handleRUTChange = (raw: string) => {
    const formatted = formatRUT(raw)
    set('rut', formatted)
    const digits = formatted.replace(/\D/g, '')
    if (digits.length === 0) { setRutError(''); setRutValid(false); return }
    const result = validateRUT(digits)
    if (result.valid) { setRutError(''); setRutValid(true) }
    else { setRutError(result.error ?? ''); setRutValid(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (rutError) return // bloquear submit si RUT inválido
    setLoading(true)
    try {
      const result = await tenantsApi.create({
        ...form,
        plan_id: Number(form.plan_id),
      })
      // Show credentials step if present
      if (result?.admin_credentials) {
        setCredentials(result.admin_credentials)
        onCreated()
      } else {
        onClose()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Error creando empresa')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (credentials) {
      navigator.clipboard.writeText(credentials.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    if (credentials) {
      onClose()
    } else {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={credentials ? undefined : handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {credentials ? (
          // Step 2: Show credentials
          <>
            <h2 className="modal-title">Credenciales generadas</h2>
            <div style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 10,
              padding: '16px',
              marginBottom: 16,
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Email de administrador</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{credentials.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Contraseña temporal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    ref={pwRef}
                    readOnly
                    value={credentials.password}
                    style={{
                      flex: 1,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    className="btn btn-ghost"
                    onClick={handleCopy}
                    style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    <Copy size={13} /> {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: '0.8rem',
              color: '#d97706',
            }}>
              Esta contraseña solo se muestra una vez. Compartila de forma segura con el administrador del tenant.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleClose}>
                Entendido, cerrar
              </button>
            </div>
          </>
        ) : (
          // Step 1: Create form
          <>
            <h2 className="modal-title">Nueva Empresa</h2>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.8rem', color: '#ef4444' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la empresa *</label>
                <input value={form.company_name} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (identificador único) *</label>
                <input value={form.slug} onChange={(e) => set('slug', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">RUT</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.rut}
                    onChange={(e) => handleRUTChange(e.target.value)}
                    placeholder="219876543-0"
                    style={{
                      paddingRight: 36,
                      borderColor: rutError ? 'rgba(239,68,68,0.6)' : rutValid ? 'rgba(34,197,94,0.6)' : undefined,
                    }}
                  />
                  {rutValid && (
                    <CheckCircle size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#22c55e' }} />
                  )}
                  {rutError && (
                    <XCircle size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ef4444' }} />
                  )}
                </div>
                {rutError && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{rutError}</div>
                )}
                {rutValid && (
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: 4 }}>RUT válido ✓</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Email del administrador *</label>
                <input type="email" value={form.admin_email} onChange={(e) => set('admin_email', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre del administrador</label>
                <input value={form.admin_name} onChange={(e) => set('admin_name', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Plan *</label>
                  <select value={form.plan_id} onChange={(e) => set('plan_id', Number(e.target.value))}>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado inicial</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value as 'trial' | 'active')}>
                    <option value="trial">Trial</option>
                    <option value="active">Activo</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear empresa'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
