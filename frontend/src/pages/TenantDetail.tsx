import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, KeyRound, RefreshCw, Upload, FileText, ChevronRight, Trash2, X } from 'lucide-react'
import { tenants as tenantsApi, plans as plansApi, support as supportApi } from '../services/api'
import type { Tenant, Plan, SupportTicket, CAERange, CAEParseResult, InvoiceType } from '../types'
import CertPanel from '../components/CertPanel'

type Tab = 'info' | 'soporte' | 'suscripcion' | 'uso' | 'cert' | 'cae'

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

  // CAE state
  const [caeRanges, setCaeRanges] = useState<CAERange[]>([])
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceType[]>([])
  const [caeLoading, setCaeLoading] = useState(false)
  const [caeModal, setCaeModal] = useState(false)
  const [caeModalMode, setCaeModalMode] = useState<'choose' | 'xml' | 'manual'>('choose')
  const [caeForm, setCaeForm] = useState({ invoice_type_id: 0, serie: 'A', range_from: '', range_to: '', expires_at: '' })
  const [parsedCAE, setParsedCAE] = useState<CAEParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [caeSaving, setCaeSaving] = useState(false)
  const caeFileRef = useRef<HTMLInputElement>(null)

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

  const loadCAE = () => {
    if (!id) return
    setCaeLoading(true)
    Promise.all([tenantsApi.getCAERanges(id), tenantsApi.getInvoiceTypes(id)])
      .then(([ranges, types]) => { setCaeRanges(ranges); setInvoiceTypes(types) })
      .finally(() => setCaeLoading(false))
  }

  const resetCaeModal = () => {
    setCaeModalMode('choose'); setParsedCAE(null); setParseError('')
    setCaeForm({ invoice_type_id: invoiceTypes[0]?.id ?? 0, serie: 'A', range_from: '', range_to: '', expires_at: '' })
  }

  const handleCaeXMLFile = async (file: File) => {
    if (!id) return
    setParsing(true); setParseError(''); setParsedCAE(null)
    try {
      const data = await tenantsApi.parseCAEXML(id, file)
      setParsedCAE(data)
      setCaeForm({ invoice_type_id: data.invoice_type_id, serie: data.serie, range_from: String(data.dnro), range_to: String(data.hnro), expires_at: data.fvd })
    } catch (err: unknown) {
      setParseError((err as { response?: { data?: string } })?.response?.data ?? 'Error al parsear el XML')
    } finally { setParsing(false) }
  }

  const handleCreateCAERange = async () => {
    if (!id || !caeForm.invoice_type_id || !caeForm.range_from || !caeForm.range_to) return
    setCaeSaving(true)
    try {
      await tenantsApi.createCAERange(id, {
        invoice_type_id: caeForm.invoice_type_id,
        serie: caeForm.serie,
        range_from: Number(caeForm.range_from),
        range_to: Number(caeForm.range_to),
        expires_at: caeForm.expires_at || undefined,
      })
      setCaeModal(false); resetCaeModal(); loadCAE()
    } finally { setCaeSaving(false) }
  }

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
        {(['info', 'soporte', 'suscripcion', 'uso', 'cert', 'cae'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); if (t === 'cae') loadCAE() }}
          >
            {t === 'info' ? 'Información' : t === 'soporte' ? 'Soporte' : t === 'suscripcion' ? 'Suscripción' : t === 'uso' ? 'Uso' : t === 'cert' ? '🔐 Certificado DGI' : '⚡ CAE'}
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

      {/* Tab: Certificado DGI */}
      {tab === 'cert' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Certificado Digital DGI
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Gestioná el certificado PKCS#12 (.pfx) del tenant para la emisión de CFEs.
            Podés cargar o reemplazar el certificado en nombre del cliente.
          </p>
          <CertPanel
            statusFn={() => tenantsApi.getCertStatus(id!)}
            uploadFn={(file, password, notes) => tenantsApi.uploadCert(id!, file, password, notes)}
            historyFn={() => tenantsApi.getCertHistory(id!)}
          />
        </div>
      )}

      {/* Tab: CAE */}
      {tab === 'cae' && (
        <div>
          {/* Alertas de vencimiento */}
          {caeRanges.some((r) => r.is_expired) && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.83rem', color: '#ef4444' }}>
              ⚠️ Hay rangos CAE <strong>vencidos</strong>. No podrán utilizarse para emitir CFEs.
            </div>
          )}
          {!caeRanges.some((r) => r.is_expired) && caeRanges.some((r) => r.expiry_warning) && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.83rem', color: '#d97706' }}>
              ⏳ Hay rangos CAE próximos a vencer. Renovar antes de la fecha límite.
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--input-border)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Rangos CAE autorizados</span>
              <button className="btn btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => { resetCaeModal(); setCaeModal(true) }}>
                <Upload size={13} /> Cargar Rango CAE
              </button>
            </div>

            {caeLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tipo CFE</th>
                      <th>Serie</th>
                      <th>Desde</th>
                      <th>Hasta</th>
                      <th>Disponible</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {caeRanges.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin rangos CAE cargados</td></tr>
                    )}
                    {caeRanges.map((r) => (
                      <tr key={r.ID} style={{ opacity: r.is_expired ? 0.6 : 1 }}>
                        <td style={{ fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.invoice_type_code}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{r.invoice_type_name}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: '#818cf8' }}>{r.serie}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.range_from.toLocaleString('es-UY')}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.range_to.toLocaleString('es-UY')}</td>
                        <td>
                          <span style={{ color: r.available === 0 ? '#ef4444' : r.used_pct > 80 ? '#f59e0b' : '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>
                            {r.available.toLocaleString('es-UY')}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> ({r.used_pct.toFixed(0)}% usado)</span>
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>
                          {r.expires_at ? (
                            <span style={{ color: r.is_expired ? '#ef4444' : r.expiry_warning ? '#f59e0b' : 'var(--text-secondary)' }}>
                              {new Date(r.expires_at).toLocaleDateString('es-UY')}
                              {r.days_to_expiry != null && !r.is_expired && (
                                <span style={{ marginLeft: 4, fontSize: '0.72rem' }}>({r.days_to_expiry}d)</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {r.is_expired ? (
                            <span className="badge badge-red">Vencido</span>
                          ) : r.available === 0 ? (
                            <span className="badge badge-gray">Agotado</span>
                          ) : r.expiry_warning ? (
                            <span className="badge badge-yellow">Por vencer</span>
                          ) : r.is_active ? (
                            <span className="badge badge-green">Activo</span>
                          ) : (
                            <span className="badge badge-gray">Inactivo</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', color: '#ef4444' }}
                            onClick={async () => {
                              if (!id || !confirm('¿Eliminar este rango CAE?')) return
                              await tenantsApi.deleteCAERange(id, r.ID)
                              loadCAE()
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal — CAE */}
      {caeModal && (
        <div className="modal-overlay" onClick={() => { setCaeModal(false); resetCaeModal() }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>
                {caeModalMode === 'choose' ? 'Cargar Rango CAE' : caeModalMode === 'xml' ? 'Importar desde XML DGI' : 'Carga manual de CAE'}
              </h2>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setCaeModal(false); resetCaeModal() }}>
                <X size={15} />
              </button>
            </div>

            {/* Modo: elegir */}
            {caeModalMode === 'choose' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  className="btn btn-ghost"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 16px', border: '2px solid rgba(99,102,241,0.4)', borderRadius: 12 }}
                  onClick={() => setCaeModalMode('xml')}
                >
                  <FileText size={28} style={{ color: '#818cf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Desde XML DGI</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Subí el .xml que te dio DGI y se completa automáticamente</span>
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Recomendado</span>
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 16px', border: '1px solid var(--input-border)', borderRadius: 12 }}
                  onClick={() => setCaeModalMode('manual')}
                >
                  <ChevronRight size={28} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Ingreso manual</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Completar los datos del CAE manualmente</span>
                </button>
              </div>
            )}

            {/* Modo: XML */}
            {caeModalMode === 'xml' && (
              <div>
                {!parsedCAE ? (
                  <div>
                    <div
                      style={{ border: '2px dashed rgba(99,102,241,0.4)', borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
                      onClick={() => caeFileRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCaeXMLFile(f) }}
                    >
                      <Upload size={28} style={{ color: '#818cf8', marginBottom: 10 }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {parsing ? 'Procesando XML...' : 'Arrastrá o hacé clic para subir el .xml de DGI'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Archivo .xml emitido por el portal de DGI Uruguay</div>
                    </div>
                    <input ref={caeFileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCaeXMLFile(f) }} />
                    {parseError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 8 }}>{parseError}</div>}
                    <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setCaeModalMode('choose')}>← Volver</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.83rem', marginBottom: 10 }}>✓ XML procesado correctamente</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Tipo CFE:</span> <strong>{parsedCAE.tcfe} — {invoiceTypes.find((t) => t.id === parsedCAE.invoice_type_id)?.name ?? '?'}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Serie:</span> <strong style={{ fontFamily: 'monospace', color: '#818cf8' }}>{parsedCAE.serie}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Desde:</span> <strong>{parsedCAE.dnro.toLocaleString('es-UY')}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Hasta:</span> <strong>{parsedCAE.hnro.toLocaleString('es-UY')}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Cantidad:</span> <strong>{parsedCAE.cantidad.toLocaleString('es-UY')}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Vencimiento:</span> <strong>{parsedCAE.fvd}</strong></div>
                      </div>
                      {parsedCAE.warning && (
                        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#d97706' }}>⚠️ {parsedCAE.warning}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => { setParsedCAE(null); setParseError('') }}>Volver</button>
                      <button className="btn btn-primary" onClick={handleCreateCAERange} disabled={caeSaving}>
                        {caeSaving ? 'Guardando...' : 'Confirmar y guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modo: manual */}
            {caeModalMode === 'manual' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Tipo de comprobante</label>
                    <select value={caeForm.invoice_type_id} onChange={(e) => setCaeForm((f) => ({ ...f, invoice_type_id: Number(e.target.value) }))}>
                      <option value={0} disabled>Seleccionar...</option>
                      {invoiceTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serie</label>
                    <input value={caeForm.serie} onChange={(e) => setCaeForm((f) => ({ ...f, serie: e.target.value.toUpperCase() }))} maxLength={1} placeholder="A" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Desde (nro inicial)</label>
                    <input type="number" value={caeForm.range_from} onChange={(e) => setCaeForm((f) => ({ ...f, range_from: e.target.value }))} placeholder="1" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hasta (nro final)</label>
                    <input type="number" value={caeForm.range_to} onChange={(e) => setCaeForm((f) => ({ ...f, range_to: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de vencimiento <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
                    <input type="date" value={caeForm.expires_at} onChange={(e) => setCaeForm((f) => ({ ...f, expires_at: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="btn btn-ghost" onClick={() => setCaeModalMode('choose')}>← Volver</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateCAERange}
                    disabled={caeSaving || !caeForm.invoice_type_id || !caeForm.range_from || !caeForm.range_to}
                  >
                    {caeSaving ? 'Guardando...' : 'Guardar rango'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
