import React, { useState, useEffect } from 'react';
import { X, Save, KeyRound, Database, ScrollText } from 'lucide-react';
import { BackupService } from '../services/backup';
import { SessionService, AuditLog } from '../services/session';

interface Props {
  onClose: () => void;
}

/**
 * Ajustes: configuración del respaldo, códigos de acceso (solo administrador)
 * y consulta de la bitácora local.
 */
export const SettingsPanel: React.FC<Props> = ({ onClose }) => {
  const cfg = BackupService.config();
  const [url, setUrl] = useState(cfg.url);
  const [token, setToken] = useState(cfg.token);
  const [msg, setMsg] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<{ meses: any[]; anual: any } | null>(null);
  const [verLog, setVerLog] = useState(false);

  const esAdmin = SessionService.esAdmin();

  useEffect(() => {
    if (esAdmin) SessionService.generarCodigos().then(setCodigos);
  }, [esAdmin]);

  const guardar = () => {
    BackupService.guardarConfig(url, token);
    AuditLog.registrar('Configuración', 'Se actualizó el respaldo');
    setMsg('Configuración guardada.');
    setTimeout(() => setMsg(null), 2500);
  };

  const log = AuditLog.listar();

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(2,6,23,0.88)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto'
    }}>
      <div className="card-panel" style={{ maxWidth: '520px', width: '100%', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white' }}>Ajustes</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Respaldo */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Database size={16} color="#34D399" />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#E2E8F0' }}>Respaldo en Google Sheets</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '10px', lineHeight: 1.5 }}>
            Pega la URL de la aplicación web del Apps Script (termina en /exec).
          </p>
          <div className="form-group">
            <label className="form-label">URL de Apps Script</label>
            <input type="url" className="form-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" />
          </div>
          <div className="form-group">
            <label className="form-label">Token (opcional)</label>
            <input type="text" className="form-input" value={token} onChange={e => setToken(e.target.value)} placeholder="Solo si definiste API_TOKEN en el script" />
          </div>
          <button type="button" className="btn-primary" onClick={guardar} style={{ width: '100%', justifyContent: 'center' }}>
            <Save size={18} /><span>Guardar configuración</span>
          </button>
          {msg && <div style={{ fontSize: '0.8rem', color: '#34D399', marginTop: '8px' }}>{msg}</div>}
        </div>

        {/* Códigos de acceso (solo admin) */}
        {esAdmin && codigos && (
          <div style={{ marginBottom: '18px', paddingTop: '14px', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <KeyRound size={16} color="#F59E0B" />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#E2E8F0' }}>Códigos de acceso</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '10px' }}>
              Entrega el código del mes a los inspectores. El anual es para administradores.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {codigos.meses.map((m: any, i: number) => (
                <div key={m.periodo} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: i === 0 ? 'rgba(245,158,11,0.1)' : '#0F172A',
                  border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : '#334155'}`,
                  borderRadius: '8px', padding: '7px 12px'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#CBD5E1', textTransform: 'capitalize' }}>
                    {i === 0 ? 'Mes actual · ' : ''}{m.etiqueta}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: '#FBBF24', letterSpacing: '0.1em' }}>{m.codigo}</strong>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: '8px', padding: '7px 12px', marginTop: '4px'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>{codigos.anual.etiqueta}</span>
                <strong style={{ fontSize: '0.95rem', color: '#34D399', letterSpacing: '0.1em' }}>{codigos.anual.codigo}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Bitácora */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid #334155' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setVerLog(v => !v)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ScrollText size={16} color="#94A3B8" />
            <span>{verLog ? 'Ocultar' : 'Ver'} bitácora ({log.length} eventos)</span>
          </button>

          {verLog && (
            <div style={{ marginTop: '10px', maxHeight: '220px', overflowY: 'auto', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '8px' }}>
              {log.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#64748B', textAlign: 'center', padding: '10px' }}>Sin eventos registrados.</div>
              ) : log.map((e, i) => (
                <div key={i} style={{ fontSize: '0.72rem', color: '#CBD5E1', padding: '5px 0', borderBottom: '1px solid #1E293B' }}>
                  <span style={{ color: '#64748B' }}>
                    {new Date(e.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {' · '}
                  <strong style={{ color: '#34D399' }}>{e.inspector}</strong>
                  {' · '}
                  {e.accion}
                  {e.detalle ? <span style={{ color: '#94A3B8' }}> — {e.detalle}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
