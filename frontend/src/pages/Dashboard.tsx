import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { dashboard } from '../services/api'
import type { DashboardStats } from '../types'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
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

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'badge-red',
  high: 'badge-yellow',
  medium: 'badge-blue',
  low: 'badge-gray',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    dashboard.get()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Cargando dashboard...</div>
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>
        Dashboard
      </h1>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          icon={<Building2 size={20} color="#6366f1" />}
          label="Total Empresas"
          value={stats?.total_tenants ?? 0}
          sub="Todas las empresas"
          accent="#6366f1"
        />
        <StatCard
          icon={<CheckCircle size={20} color="#10b981" />}
          label="Empresas Activas"
          value={stats?.active_tenants ?? 0}
          sub={`${stats?.trial_tenants ?? 0} en trial`}
          accent="#10b981"
        />
        <StatCard
          icon={<Clock size={20} color="#f59e0b" />}
          label="En Trial"
          value={stats?.trial_tenants ?? 0}
          sub="Períodos de prueba"
          accent="#f59e0b"
        />
        <StatCard
          icon={<AlertTriangle size={20} color="#ef4444" />}
          label="Tickets Abiertos"
          value={stats?.open_tickets ?? 0}
          sub={`${stats?.critical_tickets ?? 0} críticos/altos`}
          accent="#ef4444"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Últimas empresas */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            Últimas Empresas
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_tenants?.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</td></tr>
                )}
                {stats?.recent_tenants?.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tenants/${t.id}`)}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.company_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.plan?.name ?? '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tickets críticos */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            Tickets Críticos / Urgentes
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Empresa</th>
                  <th>Título</th>
                  <th>Prioridad</th>
                  <th>Hace</th>
                </tr>
              </thead>
              <tbody>
                {stats?.critical_tickets_list?.length === 0 && (
                  <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin tickets críticos</td></tr>
                )}
                {stats?.critical_tickets_list?.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/support/${t.id}`)}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#818cf8' }}>{t.ticket_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.tenant?.company_name ?? '—'}</td>
                    <td style={{ color: 'var(--text-primary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td><span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MRR */}
      {stats && stats.mrr_estimate > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div className="stat-label">MRR Estimado</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                ${stats.mrr_estimate.toLocaleString('es-UY')} UYU
              </div>
              <div className="stat-sub">Basado en tenants activos</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  accent: string
}) {
  return (
    <div className="stat-card">
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}
