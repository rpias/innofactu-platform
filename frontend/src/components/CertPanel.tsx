import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Shield, Upload, Trash2, Clock, ChevronDown, ChevronUp, Building2, User } from "lucide-react";
import type { CertStatus, CertHistoryEntry } from "../types";

interface CertPanelProps {
  statusFn: () => Promise<CertStatus>;
  uploadFn: (file: File, password: string, notes?: string) => Promise<CertStatus>;
  historyFn: () => Promise<CertHistoryEntry[]>;
}

const STATUS_CONFIG = {
  none:     { icon: Shield,      color: "#6b7280", bg: "#f9fafb", label: "Sin certificado" },
  ok:       { icon: ShieldCheck, color: "#16a34a", bg: "#f0fdf4", label: "Vigente" },
  warning:  { icon: ShieldAlert, color: "#d97706", bg: "#fffbeb", label: "Por vencer" },
  critical: { icon: ShieldAlert, color: "#dc2626", bg: "#fef2f2", label: "Vence pronto" },
  expired:  { icon: ShieldX,     color: "#dc2626", bg: "#fef2f2", label: "Vencido" },
} as const;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CertPanel({ statusFn, uploadFn, historyFn }: CertPanelProps) {
  const [status, setStatus] = useState<CertStatus | null>(null);
  const [history, setHistory] = useState<CertHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      const data = await statusFn();
      setStatus(data);
    } catch { /* silencioso */ }
  };

  const fetchHistory = async () => {
    try {
      const data = await historyFn();
      setHistory(data ?? []);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  const handleUpload = async () => {
    if (!selectedFile) { setErrorMsg("Seleccioná un archivo .pfx"); return; }
    if (!password) { setErrorMsg("La contraseña del certificado es requerida"); return; }
    setErrorMsg("");
    setSuccessMsg("");
    setUploading(true);
    try {
      const data = await uploadFn(selectedFile, password, notes || undefined);
      setStatus(data);
      setSelectedFile(null);
      setPassword("");
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      if (data.expiry_status === "expired") {
        setSuccessMsg("Certificado subido pero ya está vencido. Renovarlo cuanto antes.");
      } else if (data.expiry_status === "critical" || data.expiry_status === "warning") {
        setSuccessMsg(`Certificado subido. Vence en ${data.days_until_expiry} días.`);
      } else {
        setSuccessMsg("Certificado cargado correctamente.");
      }
      if (showHistory) fetchHistory();
    } catch (err: any) {
      setErrorMsg(err.response?.data ?? "Error al cargar el certificado");
    } finally {
      setUploading(false);
    }
  };

  const cfg = STATUS_CONFIG[status?.expiry_status ?? "none"];
  const Icon = cfg.icon;

  const inp: React.CSSProperties = {
    width: "100%", border: "1px solid var(--input-border)", borderRadius: 6,
    padding: "7px 10px", background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "0.83rem", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Estado actual */}
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 8, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon size={20} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: cfg.color }}>{cfg.label}</div>
          {status?.has_cert ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginTop: 8, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              <span><b>Vencimiento:</b> {fmtDate(status.expiry_date)} ({status.days_until_expiry >= 0 ? `${status.days_until_expiry} días` : "vencido"})</span>
              <span><b>RUT en cert:</b> {status.subject_rut ?? "—"}</span>
              <span><b>Serial:</b> {status.serial ? status.serial.slice(0, 20) + "…" : "—"}</span>
              <span><b>Subido por:</b> {status.uploaded_by ?? "—"}</span>
              <span><b>Fecha subida:</b> {fmtDateTime(status.uploaded_at)}</span>
            </div>
          ) : (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              No hay certificado cargado. Sin él el tenant no puede emitir CFEs.
            </div>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      {errorMsg && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "8px 12px", fontSize: "0.8rem", color: "#ef4444" }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, padding: "8px 12px", fontSize: "0.8rem", color: "#059669" }}>
          {successMsg}
        </div>
      )}

      {/* Upload */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ fontWeight: 600, fontSize: "0.83rem", color: "var(--text-primary)", marginBottom: 10 }}>
          {status?.has_cert ? "Reemplazar certificado" : "Cargar certificado (.pfx)"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Archivo .pfx / .p12</label>
            <input ref={fileRef} type="file" accept=".pfx,.p12,application/x-pkcs12"
              onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setErrorMsg(""); }}
              style={{ ...inp, padding: "5px 8px" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Contraseña del certificado</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña del .pfx" style={inp} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Renovación 2026, cert enviado por cliente…" style={inp} />
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleUpload} disabled={uploading || !selectedFile || !password}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.83rem" }}>
            <Upload size={13} /> {uploading ? "Cargando…" : "Cargar certificado"}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div>
        <button onClick={() => setShowHistory(p => !p)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={12} /> Historial de certificados</span>
          {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showHistory && (
          <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
            {history.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>Sin historial disponible</div>
            ) : history.map(h => (
              <div key={h.ID} style={{ display: "flex", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.78rem" }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {h.uploaded_source === "platform"
                    ? <Building2 size={12} style={{ color: "#7c3aed" }} />
                    : <User size={12} style={{ color: "#2563eb" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtDateTime(h.uploaded_at)}</div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {h.uploaded_by} · {h.uploaded_source === "platform" ? "vía Platform" : "vía tenant"}
                    {h.cert_expiry && ` · vence ${fmtDate(h.cert_expiry)}`}
                  </div>
                  {h.notes && <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{h.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
