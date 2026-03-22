import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Lock, Unlock } from 'lucide-react'
import { support as supportApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { SupportTicket, SupportMessage } from '../types'

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-gray',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
}
const STATUS_BADGE: Record<string, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', waiting: 'badge-gray',
  resolved: 'badge-green', closed: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting: 'Esperando cliente',
  resolved: 'Resuelto', closed: 'Cerrado',
}
const CATEGORY_LABEL: Record<string, string> = {
  billing: 'Facturación', technical: 'Técnico', onboarding: 'Onboarding',
  feature: 'Funcionalidad', other: 'Otro',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMsg, setNewMsg] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const t = await supportApi.getTicket(Number(id))
      setTicket(t)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Cargando ticket...</div>
  if (!ticket) return <div style={{ color: 'var(--danger)', padding: 40 }}>Ticket no encontrado</div>

  const handleSend = async () => {
    if (!newMsg.trim() || !user) return
    setSending(true)
    try {
      const msg = await supportApi.addMessage(ticket.id, {
        content: newMsg.trim(),
        author_type: 'agent',
        author_name: user.full_name,
        is_internal: isInternal,
      })
      setTicket((t) => t ? { ...t, messages: [...(t.messages ?? []), msg] } : t)
      setNewMsg('')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    setUpdatingStatus(true)
    try {
      const updated = await supportApi.update(ticket.id, { status: newStatus })
      setTicket((t) => t ? { ...t, status: updated.status } : t)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handlePriorityChange = async (newPriority: string) => {
    if (!id) return
    try {
      const updated = await supportApi.update(ticket.id, { priority: newPriority })
      setTicket((t) => t ? { ...t, priority: updated.priority } : t)
    } catch {}
  }

  const slaOk = ticket.sla_deadline ? new Date(ticket.sla_deadline) > new Date() : true

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, height: 'calc(100vh - 100px)' }}>
      {/* Main column */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/support')} style={{ padding: '6px 10px', flexShrink: 0, marginTop: 2 }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#818cf8', fontWeight: 700 }}>
                {ticket.ticket_number}
              </span>
              <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
              <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{PRIORITY_LABEL[ticket.priority]}</span>
              {ticket.category && (
                <span className="badge badge-gray">{CATEGORY_LABEL[ticket.category] ?? ticket.category}</span>
              )}
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {ticket.title}
            </h1>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {ticket.tenant?.company_name} · {ticket.opened_by_name} &lt;{ticket.opened_by_email}&gt; · {formatDate(ticket.created_at)}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
          paddingRight: 4, marginBottom: 16,
        }}>
          {(ticket.messages ?? []).length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: '0.85rem' }}>
              No hay mensajes aún
            </div>
          )}
          {(ticket.messages ?? []).map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {ticket.status !== 'closed' && (
          <div className="card" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend()
                  }}
                  placeholder={isInternal ? 'Nota interna (solo visible para el equipo)...' : 'Responder al cliente...'}
                  rows={3}
                  style={{
                    resize: 'none',
                    borderColor: isInternal ? 'rgba(245,158,11,0.5)' : 'var(--input-border)',
                    background: isInternal ? 'rgba(245,158,11,0.05)' : 'var(--input-bg)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className={`btn ${isInternal ? 'btn-warning' : 'btn-ghost'}`}
                  onClick={() => setIsInternal(!isInternal)}
                  title={isInternal ? 'Nota interna' : 'Respuesta al cliente'}
                  style={{ padding: '8px 10px' }}
                >
                  {isInternal ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={sending || !newMsg.trim()}
                  style={{ padding: '8px 12px' }}
                  title="Enviar (Ctrl+Enter)"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: isInternal ? '#f59e0b' : 'var(--text-muted)' }}>
                {isInternal ? '🔒 Nota interna — no visible para el cliente' : '↩ Respuesta pública — Ctrl+Enter para enviar'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        {/* Status / Priority */}
        <div className="card">
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
            >
              <option value="open">Abierto</option>
              <option value="in_progress">En progreso</option>
              <option value="waiting">Esperando cliente</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Prioridad</label>
            <select value={ticket.priority} onChange={(e) => handlePriorityChange(e.target.value)}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
        </div>

        {/* SLA */}
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>SLA</div>
          {ticket.sla_deadline ? (
            <div>
              <div style={{ fontSize: '0.82rem', color: slaOk ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {slaOk ? '✓ En tiempo' : '⚠ Vencido'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Vence: {formatDate(ticket.sla_deadline)}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin SLA definido</div>
          )}
        </div>

        {/* Empresa */}
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>Empresa</div>
          <div
            style={{ fontWeight: 600, color: '#818cf8', cursor: 'pointer', fontSize: '0.9rem' }}
            onClick={() => navigate(`/tenants/${ticket.tenant_id}`)}
          >
            {ticket.tenant?.company_name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Plan: {ticket.tenant?.plan?.name ?? '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {ticket.tenant?.admin_email}
          </div>
        </div>

        {/* Abrió el ticket */}
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>Solicitante</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {ticket.opened_by_name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ticket.opened_by_email}</div>
        </div>

        {/* Agente */}
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 8 }}>Agente asignado</div>
          {ticket.assigned_to ? (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {ticket.assigned_to.full_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ticket.assigned_to.email}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin asignar</div>
          )}
        </div>

        {/* CSAT */}
        {ticket.satisfaction_score !== null && ticket.satisfaction_score !== undefined && (
          <div className="card">
            <div className="stat-label" style={{ marginBottom: 6 }}>Satisfacción</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ fontSize: '1.2rem', opacity: n <= ticket.satisfaction_score! ? 1 : 0.2 }}>★</span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="card" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Creado:</span>{' '}
            {formatDate(ticket.created_at)}
          </div>
          {ticket.first_response_at && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>1ª respuesta:</span>{' '}
              {formatDate(ticket.first_response_at)}
            </div>
          )}
          {ticket.resolved_at && (
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Resuelto:</span>{' '}
              {formatDate(ticket.resolved_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAgent = msg.author_type === 'agent'
  const isSystem = msg.author_type === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
        — {msg.content} —
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isAgent ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '80%',
        background: isAgent
          ? (msg.is_internal ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.15)')
          : 'var(--card-bg)',
        border: `1px solid ${isAgent
          ? (msg.is_internal ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)')
          : 'var(--card-border)'}`,
        borderRadius: isAgent ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isAgent ? '#818cf8' : 'var(--text-primary)' }}>
            {msg.author_name}
          </span>
          {msg.is_internal && (
            <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>🔒 Interna</span>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {msg.content}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
          {new Date(msg.created_at).toLocaleString('es-UY', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  )
}
