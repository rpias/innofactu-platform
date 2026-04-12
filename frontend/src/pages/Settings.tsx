import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, RefreshCw, ShieldCheck, ShieldAlert, Shield } from 'lucide-react'
import api from '../services/api'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface DGICertMeta {
  id: number
  expires_at: string
  subject_name: string
  subject_rut: string
  uploaded_at: string
  uploaded_by: string
  days_left: number
  status: 'ok' | 'expiring_soon' | 'expired' | 'unknown'
}

interface DGICertResponse {
  configured: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const statusConfig = {
  ok: { icon: ShieldCheck, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'Vigente' },
  expiring_soon: { icon: ShieldAlert, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Por vencer' },
  expired: { icon: ShieldAlert, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: 'Vencido' },
  unknown: { icon: Shield, color: 'var(--text-muted)', bg: 'var(--search-bg)', border: 'var(--input-border)', label: 'Sin fecha' },
}

// ──────────────────────────────────────────────────────────────────────────────
// Settings Page
// ──────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [cert, setCert] = useState<DGICertMeta | null>(null)
  const [certConfigured, setCertConfigured] = useState<boolean | null>(null) // null = loading
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [password, setPassword] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadCert() }, [])

  const loadCert = async () => {
    setCertConfigured(null)
    try {
      const r = await api.get<DGICertMeta | DGICertResponse>('/platform/dgi-cert')
      const data = r.data as any
      if (data.configured === false) {
        setCert(null)
        setCertConfigured(false)
      } else {
        setCert(data as DGICertMeta)
        setCertConfigured(true)
      }
    } catch {
      setCert(null)
      setCertConfigured(false)
    }
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Seleccioná un archivo .pfx'); return }
    if (!password) { setError('Ingresá la contraseña del certificado'); return }

    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('password', password)
      const r = await api.post<DGICertMeta>('/platform/dgi-cert', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCert(r.data)
      setCertConfigured(true)
      setShowUploadForm(false)
      setPassword('')
      if (fileRef.current) fileRef.current.value = ''
      setSuccess('Certificado actualizado correctamente')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al subir el certificado')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el certificado DGI global? La consulta de RUT dejará de funcionar.')) return
    setDeleting(true)
    try {
      await api.delete('/platform/dgi-cert')
      setCert(null)
      setCertConfigured(false)
      setShowUploadForm(false)
    } catch {
      setError('Error al eliminar el certificado')
    } finally {
      setDeleting(false)
    }
  }

  const StatusIcon = cert ? statusConfig[cert.status].icon : Shield

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        Configuración
      </h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 28 }}>
        Ajustes globales de la plataforma InnoFactu.
      </p>

      {/* ── Sección: Certificado DGI Global ─────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Shield size={18} style={{ color: '#818cf8' }} />
          <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Certificado DGI Global
          </h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Certificado PKCS12 (.pfx) utilizado para la consulta de RUT contra la API de DGI.
          Es compartido por todos los tenants. Renovarlo aquí reemplaza el anterior inmediatamente.
        </p>

        {/* Estado actual */}
        {certConfigured === null && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cargando...</p>
        )}

        {certConfigured === false && (
          <div style={{
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <ShieldAlert size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ef4444' }}>Sin certificado configurado</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                La consulta de RUT no está disponible. Subí un certificado .pfx para habilitarla.
              </div>
            </div>
          </div>
        )}

        {cert && (
          <div style={{
            background: statusConfig[cert.status].bg,
            border: `1px solid ${statusConfig[cert.status].border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <StatusIcon size={22} style={{ color: statusConfig[cert.status].color, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: statusConfig[cert.status].color }}>
                    {statusConfig[cert.status].label}
                    {cert.days_left > 0
                      ? ` — vence en ${cert.days_left} días (${fmtDate(cert.expires_at)})`
                      : cert.days_left < 0
                      ? ` — venció el ${fmtDate(cert.expires_at)}`
                      : ` — vence hoy`}
                  </div>
                  {cert.subject_name && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {cert.subject_name}{cert.subject_rut ? ` · RUT ${cert.subject_rut}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    Subido el {fmtDate(cert.uploaded_at)} por {cert.uploaded_by}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ color: '#ef4444', fontSize: '0.75rem', padding: '4px 8px', flexShrink: 0 }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>
        )}

        {/* Formulario de carga */}
        {!showUploadForm ? (
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.83rem' }}
            onClick={() => { setShowUploadForm(true); setError('') }}
          >
            <Upload size={14} />
            {cert ? 'Reemplazar certificado' : 'Subir certificado .pfx'}
          </button>
        ) : (
          <div style={{ background: 'var(--search-bg)', borderRadius: 10, padding: 16 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              {cert ? 'Reemplazar certificado DGI' : 'Subir certificado DGI'}
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Archivo .pfx
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pfx,.p12"
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 7, border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)', color: 'var(--text-primary)',
                    fontSize: '0.82rem', cursor: 'pointer',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Contraseña del certificado
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="contraseña del .pfx"
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 7, border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)', color: 'var(--text-primary)',
                    fontSize: '0.83rem', fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                marginTop: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 7, padding: '8px 12px', fontSize: '0.82rem', color: '#ef4444',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowUploadForm(false); setError(''); setPassword('') }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {uploading && <RefreshCw size={13} className="animate-spin" />}
                {uploading ? 'Subiendo...' : 'Guardar certificado'}
              </button>
            </div>
          </div>
        )}

        {success && (
          <div style={{
            marginTop: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 7, padding: '8px 12px', fontSize: '0.82rem', color: '#10b981',
          }}>
            ✓ {success}
          </div>
        )}
      </div>
    </div>
  )
}
