import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, KeyRound, RefreshCw, Upload, FileText, ChevronRight, Trash2, X } from 'lucide-react'
import { tenants as tenantsApi, plans as plansApi, support as supportApi, erpOrigin, addons as addonsApi, type ECommerceAddon, type TenantAddonSubscription } from '../services/api'
import type { Tenant, Plan, SupportTicket, CAERange, CAEParseResult, InvoiceType } from '../types'
import CertPanel from '../components/CertPanel'

type Tab = 'info' | 'soporte' | 'suscripcion' | 'uso' | 'cert' | 'cae' | 'integraciones'

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
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoURL, setLogoURL] = useState('')

  // Integraciones e-commerce state
  const [allAddons, setAllAddons] = useState<ECommerceAddon[]>([])
  const [tenantSubs, setTenantSubs] = useState<TenantAddonSubscription[]>([])
  const [addonLoading, setAddonLoading] = useState(false)
  const [activating, setActivating] = useState<number | null>(null) // addon_id en proceso
  const [addonForm, setAddonForm] = useState<{ cycle: 'monthly' | 'yearly'; months: number; notes: string }>({ cycle: 'monthly', months: 1, notes: '' })
  const [selectedAddon, setSelectedAddon] = useState<ECommerceAddon | null>(null)
  const [addonError, setAddonError] = useState('')

  // Toast de notificación
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Modal de confirmación genérico
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onConfirm: () => void } | null>(null)

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((t as any).logo_url) setLogoURL((t as any).logo_url)
    }).finally(() => setLoading(false))
  }, [id])

  const loadIntegraciones = () => {
    if (!id) return
    setAddonLoading(true)
    Promise.all([addonsApi.list(), addonsApi.getTenantAddons(id)])
      .then(([catalog, subs]) => { setAllAddons(catalog); setTenantSubs(subs) })
      .finally(() => setAddonLoading(false))
  }

  const handleActivateAddon = async (addon: ECommerceAddon) => {
    if (!id) return
    setActivating(addon.ID)
    setAddonError('')
    try {
      await addonsApi.activate(id, {
        addon_id: addon.ID,
        billing_cycle: addonForm.cycle,
        months: addonForm.months,
        notes: addonForm.notes,
      })
      setSelectedAddon(null)
      loadIntegraciones()
      showToast(`${addon.name} activada correctamente`)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data || 'Error al activar el add-on'
      setAddonError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
    finally { setActivating(null) }
  }

  const handleCancelAddon = (subId: number) => {
    setConfirmModal({
      msg: '¿Cancelar esta integración? El tenant perderá el acceso al vencer el período actual.',
      onConfirm: async () => {
        setConfirmModal(null)
        if (!id) return
        await addonsApi.cancel(id, subId)
        loadIntegraciones()
        showToast('Integración cancelada')
      },
    })
  }

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

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setLogoUploading(true)
    try {
      const result = await tenantsApi.uploadLogo(id, file)
      setLogoURL(result.logo_url)
    } catch {
      setErrorMsg('Error al subir el logo.')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
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
        {(['info', 'soporte', 'suscripcion', 'uso', 'cert', 'cae', 'integraciones'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); if (t === 'cae') loadCAE(); if (t === 'integraciones') loadIntegraciones() }}
          >
            {t === 'info' ? 'Información' : t === 'soporte' ? 'Soporte' : t === 'suscripcion' ? 'Suscripción' : t === 'uso' ? 'Uso' : t === 'cert' ? '🔐 Certificado DGI' : t === 'cae' ? '⚡ CAE' : '🛒 Integraciones'}
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
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Logo del tenant</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logoURL && (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={`${erpOrigin()}${logoURL}`}
                      alt="Logo"
                      style={{ maxHeight: 60, maxWidth: 180, border: '1px solid #e2e8f0', borderRadius: 6, padding: 4, background: '#fff' }}
                    />
                    <button
                      type="button"
                      onClick={() => setLogoURL('')}
                      style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={10} color="white" />
                    </button>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <button
                  type="button"
                  className="btn"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content' }}
                >
                  <Upload size={13} />
                  {logoUploading ? 'Subiendo...' : logoURL ? 'Cambiar logo' : 'Subir logo'}
                </button>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>JPG, PNG, WebP o GIF · máx. 10 MB · se redimensiona a 600×300 px</div>
              </div>
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
                            onClick={() => {
                              setConfirmModal({
                                msg: '¿Eliminar este rango CAE? Esta acción no se puede deshacer.',
                                onConfirm: async () => {
                                  setConfirmModal(null)
                                  if (!id) return
                                  await tenantsApi.deleteCAERange(id, r.ID)
                                  loadCAE()
                                },
                              })
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

      {/* Tab: Integraciones E-Commerce */}
      {tab === 'integraciones' && (
        <div>
          {addonLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando...</p>
          ) : (
            <>
              {/* Suscripciones activas */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: 'var(--text-primary)' }}>
                  Integraciones contratadas
                </h3>
                {tenantSubs.filter(s => s.status === 'active').length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>Sin integraciones activas.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr>
                        {['Plataforma', 'Ciclo', 'Precio pagado', 'Expira', 'Estado', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--input-border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tenantSubs.filter(s => s.status === 'active').map(sub => (
                        <tr key={sub.ID} style={{ borderBottom: '1px solid var(--input-border)' }}>
                          <td style={{ padding: '8px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sub.addon?.name}</span>
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            {sub.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            ${sub.price_paid?.toLocaleString('es-UY')} UYU
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            {new Date(sub.expires_at).toLocaleDateString('es-UY')}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span className="badge badge-green">Activa</span>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', color: '#ef4444', fontSize: '0.75rem' }}
                              onClick={() => handleCancelAddon(sub.ID)}
                            >
                              Cancelar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Catálogo de add-ons disponibles */}
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Activar nueva integración
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Seleccioná una plataforma para activarla en este tenant. Se registra la suscripción y el tenant tendrá acceso inmediato.
                </p>

                {selectedAddon ? (
                  /* Formulario de activación */
                  <div style={{ background: 'var(--search-bg)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-primary)' }}>
                      Activar: {selectedAddon.name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Ciclo</label>
                        <select
                          value={addonForm.cycle}
                          onChange={e => setAddonForm(f => ({ ...f, cycle: e.target.value as 'monthly' | 'yearly' }))}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
                        >
                          <option value="monthly">Mensual — ${selectedAddon.price_monthly_uyu?.toLocaleString('es-UY')} UYU/mes</option>
                          <option value="yearly">Anual — ${selectedAddon.price_yearly_uyu?.toLocaleString('es-UY')} UYU/año</option>
                        </select>
                      </div>
                      {addonForm.cycle === 'monthly' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Meses a activar</label>
                          <input
                            type="number" min={1} max={24}
                            value={addonForm.months}
                            onChange={e => setAddonForm(f => ({ ...f, months: parseInt(e.target.value) || 1 }))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Notas internas</label>
                        <input
                          type="text"
                          value={addonForm.notes}
                          onChange={e => setAddonForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="ej: promo marzo"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                      Total a registrar: <strong style={{ color: 'var(--text-primary)' }}>
                        ${addonForm.cycle === 'yearly'
                          ? selectedAddon.price_yearly_uyu?.toLocaleString('es-UY')
                          : (selectedAddon.price_monthly_uyu * addonForm.months)?.toLocaleString('es-UY')
                        } UYU
                      </strong>
                    </div>
                    {addonError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: '#ef4444', marginBottom: 12 }}>
                        {addonError}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => { setSelectedAddon(null); setAddonError('') }}>Cancelar</button>
                      <button
                        className="btn btn-primary"
                        disabled={activating === selectedAddon.ID}
                        onClick={() => handleActivateAddon(selectedAddon)}
                      >
                        {activating === selectedAddon.ID ? 'Activando...' : 'Confirmar activación'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Grid de plataformas */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {allAddons.map(addon => {
                      const active = tenantSubs.some(s => s.addon_id === addon.ID && s.status === 'active')
                      return (
                        <div
                          key={addon.ID}
                          style={{
                            border: `1px solid ${active ? 'rgba(16,185,129,0.4)' : 'var(--input-border)'}`,
                            borderRadius: 10,
                            padding: '12px 14px',
                            background: active ? 'rgba(16,185,129,0.05)' : 'var(--card-bg)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{addon.name}</span>
                            {active && <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>Activa</span>}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                            {addon.description}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                            ${addon.price_monthly_uyu?.toLocaleString('es-UY')} UYU/mes
                          </div>
                          <button
                            className="btn btn-primary"
                            style={{ width: '100%', fontSize: '0.75rem', padding: '6px 0' }}
                            onClick={() => { setSelectedAddon(addon); setAddonForm({ cycle: 'monthly', months: 1, notes: '' }) }}
                          >
                            {active ? 'Renovar / Extender' : 'Activar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal — Show reset credentials */}
      {resetCredentials && (
        <ResetPasswordModal
          credentials={resetCredentials}
          onClose={() => setResetCredentials(null)}
        />
      )}

      {/* Modal de confirmación genérico */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 className="modal-title">Confirmar acción</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              {confirmModal.msg}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#ef4444' }} onClick={confirmModal.onConfirm}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificación */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', borderRadius: 10, padding: '12px 20px',
          fontSize: '0.875rem', fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 340,
        }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
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
