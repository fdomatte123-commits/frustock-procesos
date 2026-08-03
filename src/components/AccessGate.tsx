import React, { useState, useEffect } from 'react';
import { Lock, UserCheck, KeyRound, ShieldCheck } from 'lucide-react';
import { SessionService, AuditLog } from '../services/session';

interface Props {
  onReady: () => void;
}

/**
 * Puerta de entrada: valida el código de acceso (mensual o anual) y
 * registra quién usa la app, para firmar todos los registros de la jornada.
 */
export const AccessGate: React.FC<Props> = ({ onReady }) => {
  const [paso, setPaso] = useState<'codigo' | 'inspector'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    // Si el acceso sigue vigente, saltar directo a identificar al inspector
    if (SessionService.accesoVigente()) {
      if (SessionService.requiereInspector()) {
        setNombre(SessionService.inspector());
        setPaso('inspector');
      } else {
        onReady();
      }
    }
  }, [onReady]);

  const validar = async () => {
    setVerificando(true);
    setError(null);
    const tipo = await SessionService.validarCodigo(codigo);
    setVerificando(false);

    if (!tipo) {
      setError('Código incorrecto o vencido. Solicítalo al encargado de calidad.');
      setCodigo('');
      return;
    }
    SessionService.activarAcceso(tipo);
    AuditLog.registrar('Acceso concedido', `Código ${tipo}`);
    setNombre(SessionService.inspector());
    setPaso('inspector');
  };

  const confirmarInspector = () => {
    const limpio = nombre.trim();
    if (limpio.length < 3) {
      setError('Escribe tu nombre completo.');
      return;
    }
    SessionService.setInspector(limpio);
    AuditLog.registrar('Inicio de jornada', `Inspector: ${limpio}`);
    onReady();
  };

  const vigencia = SessionService.vigenciaHasta();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: '#0F172A', fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div className="card-panel" style={{ maxWidth: '400px', width: '100%', margin: 0, textAlign: 'center' }}>
        <div style={{
          background: '#F59E0B', color: '#0F172A', fontWeight: 800, fontSize: '1.1rem',
          padding: '6px 14px', borderRadius: '8px', display: 'inline-block', marginBottom: '6px'
        }}>
          FRUSTOCK
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '20px' }}>
          Procesos · Control de calidad packing
        </div>

        {paso === 'codigo' ? (
          <>
            <Lock size={32} color="#34D399" style={{ marginBottom: '10px' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }}>
              Acceso restringido
            </h2>
            <p style={{ fontSize: '0.83rem', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
              Ingresa el código de acceso vigente.
            </p>

            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              className="form-input"
              placeholder="• • • • • •"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && validar()}
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em', marginBottom: '12px' }}
            />

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <button type="button" className="btn-primary" onClick={validar} disabled={verificando} style={{ width: '100%', justifyContent: 'center' }}>
              <KeyRound size={18} />
              <span>{verificando ? 'Verificando...' : 'Entrar'}</span>
            </button>
          </>
        ) : (
          <>
            <UserCheck size={32} color="#34D399" style={{ marginBottom: '10px' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }}>
              ¿Quién realiza la inspección?
            </h2>
            <p style={{ fontSize: '0.83rem', color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
              Todos los registros e informes de hoy quedarán firmados con este nombre.
            </p>

            <input
              type="text"
              className="form-input"
              placeholder="Ej. Fernando Matte"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmarInspector()}
              style={{ textAlign: 'center', marginBottom: '12px' }}
              autoFocus
            />

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <button type="button" className="btn-primary" onClick={confirmarInspector} style={{ width: '100%', justifyContent: 'center' }}>
              <ShieldCheck size={18} />
              <span>Comenzar jornada</span>
            </button>

            {vigencia && (
              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '12px' }}>
                Acceso vigente hasta {vigencia.toLocaleDateString('es-ES')} · Perfil {SessionService.rol() === 'admin' ? 'administrador' : 'inspector'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
