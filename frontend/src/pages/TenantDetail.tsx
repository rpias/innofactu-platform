import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { tenants as tenantsApi, plans as plansApi, support as supportApi } from '../services/api'
import type { Tenant, Plan, SupportTicket } from '../types'

type Tab = 'info' | 'soporte' | 'suscripcion' | 'uso'

const STATUS_BADGE: Record<string, string> = {
  trial: 'badge-yellow', active: 'badge-green', suspended: 'badge-red', cancelled: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Activo', suspended: 'Suspendido', cancelled: 'Cancelado',
}
const PRIORITY_BADGE: Record<string, string> = {
  critical: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-gray',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Tenant>>({})
  const [resetCredentials, setResetCredentials] = useState<{ email: string; password: string; note: string } | null>(null)
  const [resetCopied, setResetCopied] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      tenantsApi.getOne(id),
      plansApi.getAll(),
      supportApi.getTickets({ tenant_id: id }),
    ]).then(([t, p, tick]) => {
      setTenant(t)
      setEditForm(t)
      setPlans(p)
      setTickets(tick)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Cargando...</div>
  if (!tenant) return <div style={{ color: 'var(--danger)', padding: 40 }}>Empresa no encontrada</div>

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      const updated = await tenantsApi.update(id, editForm)
      setTenant(updated)
      setEditForm(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleSuspend = async () => {
    if (!id) return
    setShowSuspendConfirm(false)
    await tenantsApi.suspend(id)
    const updated = await tenantsApi.getOne(id)
    setTenant(updated)
    setEditForm(updated)
  }

  const handleReactivate = async () => {
    if (!id) return
    await tenantsApi.reactivate(id)
    const updated = await tenantsApi.getOne(id)
    setTenant(updated)
    setEditForm(updated)
  }

  const handleResetAdminPassword = async () => {
    if (!id) return
    setShowResetConfirm(false)
    try {
      const result = await tenantsApi.resetAdminPassword(id)
      setResetCredentials(result)
    } catch {
      setErrorMsg('Error al resetear la contraseña. Intentá nuevamente.')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/tenants')} style={{ padding: '6px 10px' }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {tenant.company_name}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#818cf8' }}>{tenant.slug}</span>
            <span className={`badge ${STATUS_BADGE[tenant.status]}`}>{STATUS_LABEL[tenant.status]}</span>
            <span className="badge badge-purple">{tenant.plan?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowResetConfirm(true)}
            style={{ fontSize: '0.78rem' }}
            title="Resetear contraseña del administrador"
          >
            <KeyRound size={13} /> Resetear contraseña admin
          </button>
          {tenant.status !== 'suspended' && tenant.status !== 'cancelled' && (
            <button className="btn btn-danger" onClick={() => setShowSuspendConfirm(true)} style={{ fontSize: '0.78rem' }}>
              Suspender
            </button>
          )}
          {(tenant.status === 'suspended') && (
            <button className="btn btn-success" onClick={handleReactivate} style={{ fontSize: '0.78rem' }}>
              <RefreshCw size={13} /> Reactivar
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: '0.83rem',
          color: '#ef4444',
        }}>
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['info', 'soporte', 'suscripcion', 'uso'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'info' ? 'Información' : t === 'soporte' ? 'Soporte' : t === 'suscripcion' ? 'Suscripción' : 'Uso'}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      {tab === 'info' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Nombre de la empresa</label>
              <input value={editForm.company_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Slug</label>
              <input value={editForm.slug ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">RUT</label>
              <input value={editForm.rut ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, rut: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email del administrador</label>
              <input value={editForm.admin_email ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, admin_email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del administrador</label>
              <input value={editForm.admin_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, admin_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Plan</label>
              <select value={editForm.plan_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, plan_id: Number(e.target.value) }))}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select value={editForm.status ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Tenant['status'] }))}>
                <option value="trial">Trial</option>
                <option value="active">Activo</option>
                <option value="suspended">Suspendido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dominio personalizado</label>
              <input value={editForm.custom_domain ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, custom_domain: e.target.value }))} placeholder="app.miempresa.com" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notas internas</label>
              <textarea
                value={editForm.notes ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Soporte */}
      {tab === 'soporte' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Título</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin tickets</td></tr>
                )}
                {tickets.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/support/${t.id}`)}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#818cf8' }}>{t.ticket_number}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{t.title}</td>
                    <td><span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.status}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('es-UY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Suscripción */}
      {tab === 'suscripcion' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.9rem' }}>Plan actual</h3>
          <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
            <div>
              <div className="stat-label">Plan</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                {tenant.plan?.name}
              </div>
            </div>
            <div>
              <div className="stat-label">Precio mensual</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                ${tenant.plan?.price_monthly_uyu?.toLocaleString('es-UY')} UYU
              </div>
            </div>
            <div>
              <div className="stat-label">Estado</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${STATUS_BADGE[tenant.status]}`}>{STATUS_LABEL[tenant.status]}</span>
              </div>
            </div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
            Para cambiar el plan, editarlo en la pestaña Información.
          </div>
        </div>
      )}

      {/* Tab: Uso */}
      {tab === 'uso' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <UsageStat label="Facturas este mes" value={tenant.usage_invoices_month} limit={tenant.plan?.max_invoices_per_month} unit="" />
          <UsageStat label="Usuarios activos" value={tenant.usage_users} limit={tenant.plan?.max_users} unit="" />
          <UsageStat label="Almacenamiento" value={tenant.usage_storage_mb} limit={tenant.plan?.max_storage_mb} unit=" MB" />
        </div>
      )}

      {/* Modal — Confirm suspend */}
      {showSuspendConfirm && (
        <div className="modal-overlay" onClick={() => setShowSuspendConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 className="modal-title">Suspender empresa</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
              ¿Confirmás suspender <strong>{tenant.company_name}</strong>? El administrador no podrá ingresar hasta que la reactives.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSuspendConfirm(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleSuspend}>Suspender</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Confirm reset password */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 className="modal-title">Resetear contraseña admin</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
              ¿Resetear la contraseña del administrador de <strong>{tenant.company_name}</strong>?
              Se generará una nueva contraseña temporal.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowResetConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleResetAdminPassword}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Show reset credentials */}
      {resetCredentials && (
        <ResetPasswordModal
          credentials={resetCredentials}
          onClose={() => setResetCredentials(null)}
        />
      )}
    </div>
  )
}

function ResetPasswordModal({
  credentials,
  onClose,
}: {
  credentials: { email: string; password: string; note: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const pwRef = useRef<HTMLInputElement>(null)

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(credentials.password)
    } else if (pwRef.current) {
      pwRef.current.select()
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 className="modal-title">Nueva contraseña generada</h2>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Nueva contraseña temporal</div>
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
          Esta contraseña solo se muestra una vez. Compartila de forma segura con el administrador.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>Entendido, cerrar</button>
        </div>
      </div>
    </div>
  )
}

function UsageStat({ label, value, limit, unit }: { label: string; value: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0
  const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981'
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: '1.4rem' }}>
        {value}{unit}
        {limit > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {limit}{unit}</span>}
      </div>
      {limit > 0 && (
        <div style={{ marginTop: 8, height: 4, background: 'var(--input-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
      )}
    </div>
  )
}
