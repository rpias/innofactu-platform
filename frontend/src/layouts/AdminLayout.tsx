import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Headphones,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Soporte',
  billing: 'Facturación',
  sales: 'Ventas',
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        minWidth: 220,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818cf8' }}>
            InnoFactu
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Panel de Administración
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavItem to="/" icon={<LayoutDashboard size={16} />} label="Dashboard" end />
          <NavItem to="/tenants" icon={<Building2 size={16} />} label="Empresas" />
          <NavItem to="/plans" icon={<CreditCard size={16} />} label="Planes" />
          <NavItem to="/support" icon={<Headphones size={16} />} label="Soporte" />

          <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '10px 8px' }} />

          <NavItem to="/settings" icon={<Settings size={16} />} label="Configuración" />
        </nav>

        {/* User + logout */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--sidebar-border)' }}>
          {user && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name}
              </div>
              <span className="badge badge-purple" style={{ marginTop: 3 }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem' }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        textDecoration: 'none',
        fontSize: '0.85rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#818cf8' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-light)' : 'transparent',
        transition: 'all 0.15s',
      })}
    >
      {icon}
      {label}
    </NavLink>
  )
}
