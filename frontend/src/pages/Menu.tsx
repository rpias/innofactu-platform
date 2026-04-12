import { useEffect, useState } from 'react'
import {
  LayoutList,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'
import { menu as menuApi, plans as plansApi } from '../services/api'
import type { MenuItem, MenuItemWithVisibility, RoleMenuItem, Plan } from '../types'

type Tab = 'catalogo' | 'plan' | 'roles'

const APP_OPTIONS = [
  { value: 'erp', label: 'ERP (InnoFactu)' },
]

const ROLE_OPTIONS = ['admin', 'user', 'contador', 'vendedor']

const SECTION_OPTIONS = [
  'ventas', 'compras', 'caja', 'contabilidad', 'articulos', 'reportes', 'configuracion', 'integraciones',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function BoolIcon({ v }: { v: boolean }) {
  return v
    ? <CheckCircle size={14} color="#10b981" />
    : <XCircle size={14} color="#64748b" />
}

function ToggleSwitch({
  value,
  onChange,
  loading,
}: {
  value: boolean
  onChange: (v: boolean) => void
  loading?: boolean
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={loading}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: value ? '#6366f1' : 'var(--card-border)',
        position: 'relative',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Menu() {
  const [tab, setTab] = useState<Tab>('catalogo')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <LayoutList size={20} color="#818cf8" />
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Menú Dinámico
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--card-border)' }}>
        {([
          { key: 'catalogo', label: 'Catálogo' },
          { key: 'plan', label: 'Por Plan' },
          { key: 'roles', label: 'Por Rol' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#818cf8' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid #818cf8' : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && <CatalogoTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'roles' && <RolesTab />}
    </div>
  )
}

// ── Tab: Catálogo ─────────────────────────────────────────────────────────────

function CatalogoTab() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [appFilter, setAppFilter] = useState('erp')
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = () => {
    setLoading(true)
    menuApi.listItems(appFilter).then(setItems).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [appFilter])

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`¿Deshabilitar "${item.label}"?`)) return
    await menuApi.deleteItem(item.id)
    load()
  }

  // Group by section
  const sections = Array.from(new Set(items.map((i) => i.section || 'general')))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.83rem', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
          >
            {APP_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={load} style={{ padding: '6px 8px' }}>
            <RefreshCw size={14} />
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ fontSize: '0.82rem' }}>
          <Plus size={14} /> Nuevo ítem
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 32 }}>Cargando catálogo...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sections.map((section) => (
            <div key={section}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
                {items.find((i) => i.section === section)?.section_label || section}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                      {['#', 'Clave', 'Etiqueta', 'Icono', 'Ruta', 'Feature req.', 'Roles', 'Activo', ''].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((i) => (i.section || 'general') === section).map((item) => (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid var(--card-border)', opacity: item.is_active ? 1 : 0.4 }}
                      >
                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.sort_order}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', fontFamily: 'monospace', color: '#818cf8' }}>{item.key}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.83rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.label}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{item.icon}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{item.path}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.required_feature || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.default_roles || '—'}</td>
                        <td style={{ padding: '8px 12px' }}><BoolIcon v={item.is_active} /></td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost" onClick={() => setEditItem(item)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-ghost" onClick={() => handleDelete(item)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>
              No hay ítems en el catálogo para esta aplicación.
            </div>
          )}
        </div>
      )}

      {(editItem || showNew) && (
        <MenuItemModal
          item={editItem}
          appCode={appFilter}
          onClose={() => { setEditItem(null); setShowNew(false) }}
          onSaved={() => { setEditItem(null); setShowNew(false); load() }}
        />
      )}
    </div>
  )
}

// ── Tab: Por Plan ─────────────────────────────────────────────────────────────

function PlanTab() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [planItems, setPlanItems] = useState<MenuItemWithVisibility[]>([])
  const [appFilter] = useState('erp')
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([plansApi.getAll(), menuApi.listItems(appFilter)])
      .then(([p, i]) => {
        const active = p.filter((pl) => pl.is_active)
        setPlans(active)
        setItems(i)
        if (active.length > 0) setSelectedPlan(active[0])
      })
  }, [])

  useEffect(() => {
    if (!selectedPlan) return
    setLoading(true)
    menuApi.getPlanMenu(selectedPlan.code, appFilter)
      .then(setPlanItems)
      .finally(() => setLoading(false))
  }, [selectedPlan])

  const handleToggle = async (itemId: number, current: boolean) => {
    if (!selectedPlan) return
    setToggling(itemId)
    try {
      await menuApi.setPlanMenuItem(selectedPlan.code, itemId, !current)
      setPlanItems((prev) =>
        prev.map((i) => i.id === itemId ? { ...i, is_visible_in_plan: !current } : i)
      )
    } finally {
      setToggling(null)
    }
  }

  // Group by section
  const sections = Array.from(new Set(items.map((i) => i.section || 'general')))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Plan:</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlan(p)}
              className={selectedPlan?.id === p.id ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 32 }}>Cargando...</div>
      ) : selectedPlan ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            padding: '10px 16px',
            background: 'var(--accent-light)',
            borderRadius: 8,
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}>
            Configurando visibilidad de menú para el plan <strong>{selectedPlan.name}</strong>.
            Los toggles activos significan que el ítem es visible para este plan.
          </div>

          {sections.map((section) => {
            const sectionItems = planItems.filter((i) => (i.section || 'general') === section)
            if (sectionItems.length === 0) return null
            return (
              <div key={section}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {sectionItems[0]?.section_label || section}
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {sectionItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '10px 16px', width: 44 }}>
                            {item.is_visible_in_plan
                              ? <Eye size={15} color="#6366f1" />
                              : <EyeOff size={15} color="#64748b" />
                            }
                          </td>
                          <td style={{ padding: '10px 16px', flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                            <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{item.key}</div>
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.required_feature && (
                              <span className="badge badge-yellow">{item.required_feature}</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <ToggleSwitch
                              value={item.is_visible_in_plan}
                              onChange={() => handleToggle(item.id, item.is_visible_in_plan)}
                              loading={toggling === item.id}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// ── Tab: Por Rol ──────────────────────────────────────────────────────────────

function RolesTab() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [roleEntries, setRoleEntries] = useState<RoleMenuItem[]>([])
  const [appFilter] = useState('erp')
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([menuApi.listItems(appFilter), menuApi.getRoleMenu(appFilter)])
      .then(([i, r]) => { setItems(i); setRoleEntries(r) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Build lookup: itemId → isVisible for selected role
  const roleMap = new Map<number, boolean>()
  for (const entry of roleEntries) {
    if (entry.role === selectedRole) {
      roleMap.set(entry.menu_item_id, entry.is_visible)
    }
  }

  const getVisibility = (itemId: number): boolean => {
    if (roleMap.has(itemId)) return roleMap.get(itemId)!
    // Default: check default_roles of the item
    const item = items.find((i) => i.id === itemId)
    if (!item?.default_roles) return true
    return item.default_roles.split(',').map((r) => r.trim()).includes(selectedRole)
  }

  const handleToggle = async (itemId: number) => {
    const current = getVisibility(itemId)
    setToggling(itemId)
    try {
      await menuApi.setRoleMenuItem(appFilter, selectedRole, itemId, !current)
      // Update local state
      setRoleEntries((prev) => {
        const existing = prev.find((e) => e.role === selectedRole && e.menu_item_id === itemId)
        if (existing) {
          return prev.map((e) =>
            e.role === selectedRole && e.menu_item_id === itemId
              ? { ...e, is_visible: !current }
              : e
          )
        }
        return [...prev, { app_code: appFilter, role: selectedRole, menu_item_id: itemId, is_visible: !current }]
      })
    } finally {
      setToggling(null)
    }
  }

  const sections = Array.from(new Set(items.map((i) => i.section || 'general')))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Rol:</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={selectedRole === r ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: '0.82rem', padding: '6px 14px', textTransform: 'capitalize' }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 32 }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            padding: '10px 16px',
            background: 'var(--accent-light)',
            borderRadius: 8,
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}>
            Visibilidad predeterminada de menú para usuarios con rol <strong style={{ textTransform: 'capitalize' }}>{selectedRole}</strong>.
            El tenant puede aplicar overrides individuales desde su ficha.
          </div>

          {sections.map((section) => {
            const sectionItems = items.filter((i) => (i.section || 'general') === section)
            if (sectionItems.length === 0) return null
            return (
              <div key={section}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {sectionItems[0]?.section_label || section}
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {sectionItems.map((item) => {
                        const visible = getVisibility(item.id)
                        const hasOverride = roleMap.has(item.id)
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <td style={{ padding: '10px 16px', width: 44 }}>
                              {visible
                                ? <Eye size={15} color="#6366f1" />
                                : <EyeOff size={15} color="#64748b" />
                              }
                            </td>
                            <td style={{ padding: '10px 16px', flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                                {hasOverride && (
                                  <span className="badge badge-yellow" style={{ fontSize: '0.68rem' }}>personalizado</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{item.key}</div>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.default_roles && (
                                <span style={{ fontFamily: 'monospace', fontSize: '0.73rem' }}>{item.default_roles}</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <ToggleSwitch
                                value={visible}
                                onChange={() => handleToggle(item.id)}
                                loading={toggling === item.id}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Modal: Crear/Editar ítem ──────────────────────────────────────────────────

function MenuItemModal({
  item,
  appCode,
  onClose,
  onSaved,
}: {
  item: MenuItem | null
  appCode: string
  onClose: () => void
  onSaved: () => void
}) {
  const blank: Partial<MenuItem> = {
    app_code: appCode,
    key: '',
    label: '',
    icon: '',
    path: '',
    section: '',
    section_label: '',
    sort_order: 0,
    required_feature: '',
    required_addon: '',
    default_roles: 'admin,user',
    badge_key: '',
    description: '',
    is_active: true,
  }

  const [form, setForm] = useState<Partial<MenuItem>>(item ?? blank)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof MenuItem, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (item) {
        await menuApi.updateItem(item.id, form)
      } else {
        await menuApi.createItem(form)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{item ? `Editar: ${item.label}` : 'Nuevo ítem de menú'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Clave (key) *</label>
              <input
                value={form.key ?? ''}
                onChange={(e) => set('key', e.target.value)}
                placeholder="ej: invoices"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Etiqueta *</label>
              <input
                value={form.label ?? ''}
                onChange={(e) => set('label', e.target.value)}
                placeholder="ej: Facturas"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ruta (path)</label>
              <input
                value={form.path ?? ''}
                onChange={(e) => set('path', e.target.value)}
                placeholder="/invoices"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Icono (Lucide name)</label>
              <input
                value={form.icon ?? ''}
                onChange={(e) => set('icon', e.target.value)}
                placeholder="ej: FileText"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sección (code)</label>
              <input
                list="section-options"
                value={form.section ?? ''}
                onChange={(e) => set('section', e.target.value)}
                placeholder="ej: ventas"
              />
              <datalist id="section-options">
                {SECTION_OPTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Sección (etiqueta)</label>
              <input
                value={form.section_label ?? ''}
                onChange={(e) => set('section_label', e.target.value)}
                placeholder="ej: Ventas"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Orden</label>
              <input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => set('sort_order', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Feature requerida</label>
              <input
                value={form.required_feature ?? ''}
                onChange={(e) => set('required_feature', e.target.value)}
                placeholder="ej: efactura_enabled"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Add-on requerido</label>
              <input
                value={form.required_addon ?? ''}
                onChange={(e) => set('required_addon', e.target.value)}
                placeholder="ej: woocommerce"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Roles por defecto</label>
              <input
                value={form.default_roles ?? ''}
                onChange={(e) => set('default_roles', e.target.value)}
                placeholder="ej: admin,user"
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Descripción</label>
              <input
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Descripción corta del ítem"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={(e) => set('is_active', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Activo
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : item ? 'Guardar cambios' : 'Crear ítem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
