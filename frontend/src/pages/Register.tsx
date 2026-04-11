import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface RegisterForm {
  company_name: string
  rut: string
  admin_email: string
  admin_name: string
  accept_terms: boolean
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterForm>({
    company_name: '',
    rut: '',
    admin_email: '',
    admin_name: '',
    accept_terms: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.company_name || !form.admin_email) {
      setError('El nombre de empresa y el email son obligatorios.')
      return
    }
    if (!form.accept_terms) {
      setError('Debés aceptar los términos y condiciones.')
      return
    }

    setLoading(true)
    try {
      await axios.post(`${API_BASE}/register`, {
        company_name: form.company_name,
        rut: form.rut,
        admin_email: form.admin_email,
        admin_name: form.admin_name,
      })
      setAdminEmail(form.admin_email)
      setSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al crear la cuenta. Intentá de nuevo.')
      } else {
        setError('Error inesperado. Intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ width: 64, height: 64, background: '#d1fae5', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.8rem' }}>
            ✓
          </div>
          <h2 style={{ color: '#1f2937', fontWeight: 800, fontSize: '1.4rem', margin: '0 0 12px' }}>¡Cuenta creada!</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 24px' }}>
            Enviamos las credenciales de acceso a <strong style={{ color: '#7c3aed' }}>{adminEmail}</strong>.
            <br />Revisá tu bandeja de entrada (y carpeta de spam).
          </p>
          <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '16px 20px', marginBottom: 24, fontSize: '0.85rem', color: '#5b21b6', lineHeight: 1.6 }}>
            Tu cuenta está en período de prueba de <strong>14 días</strong> gratuitos.
            No se requiere tarjeta de crédito.
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Ir al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '1.8rem', margin: 0, letterSpacing: '-0.5px' }}>
            Inno<span style={{ color: '#a78bfa' }}>Factu</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 6 }}>
            Sistema de Facturación Electrónica para Uruguay
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '36px 40px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
          <h2 style={{ color: '#1f2937', fontWeight: 800, fontSize: '1.2rem', margin: '0 0 6px' }}>
            Crear cuenta gratuita
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 28px' }}>
            14 días de prueba · Sin tarjeta de crédito
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Nombre de empresa *
              </label>
              <input
                type="text"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                placeholder="Ej: Mi Empresa S.R.L."
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                RUT (opcional, podés completarlo después)
              </label>
              <input
                type="text"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                placeholder="Ej: 219449530012"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Tu nombre *
              </label>
              <input
                type="text"
                name="admin_name"
                value={form.admin_name}
                onChange={handleChange}
                placeholder="Nombre completo"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Email de administrador *
              </label>
              <input
                type="email"
                name="admin_email"
                value={form.admin_email}
                onChange={handleChange}
                placeholder="admin@empresa.com"
                required
                style={inputStyle}
              />
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Recibirás tus credenciales de acceso en este email.
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="accept_terms"
                checked={form.accept_terms}
                onChange={handleChange}
                style={{ marginTop: 2, accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>
                Acepto los <a href="#" style={{ color: '#7c3aed' }}>Términos y Condiciones</a> y la{' '}
                <a href="#" style={{ color: '#7c3aed' }}>Política de Privacidad</a>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#a78bfa' : '#7c3aed',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px 0', fontWeight: 700, fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratuita →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', marginTop: 20 }}>
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" style={{ color: '#7c3aed', fontWeight: 600 }}>Iniciá sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
