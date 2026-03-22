import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { tenants as tenantsApi, plans as plansApi } from '../services/api'
import type { Tenant, Plan } from '../types'

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
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
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

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  // Auto-generar slug desde nombre empresa
  const handleNameChange = (v: string) => {
    set('company_name', v)
    const slug = v.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    set('slug', slug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await tenantsApi.create({
        ...form,
        plan_id: Number(form.plan_id),
      })
      onCreated()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Error creando empresa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
            <input value={form.rut} onChange={(e) => set('rut', e.target.value)} placeholder="12345678-9" />
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
      </div>
    </div>
  )
}
