import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { support as supportApi } from '../services/api'
import type { SupportTicket, TicketStats } from '../types'

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-gray',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
}
const STATUS_BADGE: Record<string, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', waiting: 'badge-gray', resolved: 'badge-green', closed: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting: 'Esperando', resolved: 'Resuelto', closed: 'Cerrado',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        supportApi.getTickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        }),
        supportApi.getStats(),
      ])
      setTickets(t)
      setStats(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, priorityFilter])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>Soporte</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MiniStat label="Abiertos" value={stats?.open ?? 0} color="#3b82f6" />
        <MiniStat label="En progreso" value={stats?.in_progress ?? 0} color="#f59e0b" />
        <MiniStat label="Resueltos" value={stats?.resolved ?? 0} color="#10b981" />
        <MiniStat label="CSAT prom." value={stats?.avg_csat ? `${stats.avg_csat.toFixed(1)}/5` : '—'} color="#818cf8" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="in_progress">En progreso</option>
          <option value="waiting">Esperando</option>
          <option value="resolved">Resuelto</option>
          <option value="closed">Cerrado</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">Todas las prioridades</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Empresa</th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Prioridad</th>
                <th>Agente</th>
                <th>Tiempo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Cargando...</td></tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin tickets</td></tr>
              )}
              {!loading && tickets.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/support/${t.id}`)}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#818cf8', whiteSpace: 'nowrap' }}>
                    {t.ticket_number}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.tenant?.company_name ?? '—'}</td>
                  <td style={{ color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.category || '—'}</td>
                  <td><span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {t.assigned_to?.full_name ?? <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}
                  </td>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(t.created_at)}</td>
                  <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
