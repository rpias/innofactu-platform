import { useEffect, useState } from 'react'
import { Edit2, CheckCircle, XCircle } from 'lucide-react'
import { plans as plansApi } from '../services/api'
import type { Plan } from '../types'

function BoolIcon({ v }: { v: boolean }) {
  return v
    ? <CheckCircle size={15} color="#10b981" />
    : <XCircle size={15} color="#475569" />
}

function limitStr(v: number) {
  return v === -1 ? 'Ilimitado' : v.toLocaleString('es-UY')
}

export default function Plans() {
  const [list, setList] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)

  const load = () => {
    setLoading(true)
    plansApi.getAll().then(setList).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Cargando planes...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>Planes</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {list.map((plan) => (
          <div key={plan.id} className="card" style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{plan.name}</h2>
                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{plan.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`badge ${plan.is_public ? 'badge-green' : 'badge-gray'}`}>
                  {plan.is_public ? 'Público' : 'Privado'}
                </span>
                <span className={`badge ${plan.is_active ? 'badge-blue' : 'badge-gray'}`}>
                  {plan.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            {/* Precios */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                ${plan.price_monthly_uyu.toLocaleString('es-UY')}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>/mes</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ${plan.price_yearly_uyu.toLocaleString('es-UY')}/año
              </div>
            </div>

            {/* Límites */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <LimitRow label="Usuarios" value={limitStr(plan.max_users)} />
              <LimitRow label="Facturas/mes" value={limitStr(plan.max_invoices_per_month)} />
              <LimitRow label="Artículos" value={limitStr(plan.max_articles)} />
              <LimitRow label="Contactos" value={limitStr(plan.max_contacts)} />
              <LimitRow label="Sucursales" value={limitStr(plan.max_sucursales)} />
              <LimitRow label="Almacen." value={`${plan.max_storage_mb >= 1000 ? (plan.max_storage_mb / 1000) + 'GB' : plan.max_storage_mb + 'MB'}`} />
            </div>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
              <FeatureRow label="eFactura" value={plan.efactura_enabled} />
              <FeatureRow label="Multi-sucursal" value={plan.multi_sucursal_enabled} />
              <FeatureRow label="Acceso API" value={plan.api_access_enabled} />
              <FeatureRow label="White label" value={plan.white_label_enabled} />
              <FeatureRow label="Reportes avanzados" value={plan.advanced_reports_enabled} />
            </div>

            {/* Soporte */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Soporte</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{plan.support_level}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SLA</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{plan.support_sla_hours}h</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditPlan(plan)} style={{ fontSize: '0.78rem', padding: '6px 10px' }}>
                <Edit2 size={13} /> Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editPlan && (
        <EditPlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); load() }}
        />
      )}
    </div>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function FeatureRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
      <span style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{label}</span>
      <BoolIcon v={value} />
    </div>
  )
}

function EditPlanModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...plan })
  const [loading, setLoading] = useState(false)

  const set = (k: keyof Plan, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await plansApi.update(plan.id, form)
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Editar Plan: {plan.name}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio mensual (UYU)</label>
              <input type="number" value={form.price_monthly_uyu} onChange={(e) => set('price_monthly_uyu', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio anual (UYU)</label>
              <input type="number" value={form.price_yearly_uyu} onChange={(e) => set('price_yearly_uyu', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Máx. usuarios (-1=ilimitado)</label>
              <input type="number" value={form.max_users} onChange={(e) => set('max_users', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Máx. facturas/mes</label>
              <input type="number" value={form.max_invoices_per_month} onChange={(e) => set('max_invoices_per_month', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nivel de soporte</label>
              <select value={form.support_level} onChange={(e) => set('support_level', e.target.value)}>
                <option value="email">Email</option>
                <option value="priority">Prioritario</option>
                <option value="dedicated">Dedicado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SLA (horas)</label>
              <input type="number" value={form.support_sla_hours} onChange={(e) => set('support_sla_hours', Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            {[
              ['efactura_enabled', 'eFactura'],
              ['multi_sucursal_enabled', 'Multi-sucursal'],
              ['api_access_enabled', 'Acceso API'],
              ['white_label_enabled', 'White label'],
              ['advanced_reports_enabled', 'Reportes avanzados'],
              ['is_active', 'Activo'],
              ['is_public', 'Público'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof Plan])}
                  onChange={(e) => set(key as keyof Plan, e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
