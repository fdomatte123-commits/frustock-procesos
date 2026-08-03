import React, { useState, useMemo, useEffect } from 'react';
import { Scale, ClipboardPaste, Trash2, Check, AlertTriangle } from 'lucide-react';
import {
  ProcessData, WeightControl, BOX_FORMATS,
  parsearPesos, calcularEstadisticasPeso
} from '../types/process';
import { ProcessStorageService } from '../services/storage';
import { AuditLog } from '../services/session';

interface Props {
  process: ProcessData;
  onUpdateProcess: (p: ProcessData) => void;
}

/**
 * Control de peso de cajas del packing.
 * El pesador registra en planilla/foto; la transcripción se pega aquí en bloque
 * y la app valida contra el rango del formato, sin re-digitar peso por peso.
 */
export const WeightControlScreen: React.FC<Props> = ({ process, onUpdateProcess }) => {
  const wc = process.weightControl;

  const [formatId, setFormatId] = useState<string>(() => {
    if (wc) {
      const f = BOX_FORMATS.find(x => x.label === wc.formatLabel);
      return f ? f.id : 'custom';
    }
    const sugerido = BOX_FORMATS.find(f => f.species === process.species);
    return sugerido ? sugerido.id : 'citrus-15';
  });

  const [minKg, setMinKg] = useState<string>(wc ? String(wc.minKg) : '');
  const [maxKg, setMaxKg] = useState<string>(wc ? String(wc.maxKg) : '');
  const [texto, setTexto] = useState('');
  const [pesos, setPesos] = useState<number[]>(wc?.weights ?? []);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Al elegir un formato precargado, traer su rango (editable después)
  useEffect(() => {
    const f = BOX_FORMATS.find(x => x.id === formatId);
    if (f && f.id !== 'custom') {
      setMinKg(String(f.minKg));
      setMaxKg(String(f.maxKg));
    }
  }, [formatId]);

  const formatoActual = BOX_FORMATS.find(f => f.id === formatId);
  const min = parseFloat(minKg) || 0;
  const max = parseFloat(maxKg) || 0;

  const control: WeightControl = useMemo(() => ({
    formatLabel: formatoActual?.id === 'custom' ? 'Formato personalizado' : (formatoActual?.label ?? ''),
    minKg: min,
    maxKg: max,
    weights: pesos,
    updatedAt: new Date().toISOString()
  }), [formatoActual, min, max, pesos]);

  const stats = useMemo(() => calcularEstadisticasPeso(control), [control]);

  const previsualizados = useMemo(() => parsearPesos(texto), [texto]);

  const agregarPesos = () => {
    if (previsualizados.length === 0) {
      setMensaje('No se reconocieron números en el texto pegado.');
      return;
    }
    setPesos(prev => [...prev, ...previsualizados]);
    setTexto('');
    setMensaje(`${previsualizados.length} peso(s) agregado(s).`);
    setTimeout(() => setMensaje(null), 2500);
  };

  const pegarDesdePortapapeles = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setTexto(t);
    } catch {
      setMensaje('No se pudo leer el portapapeles. Pega el texto manualmente.');
    }
  };

  const guardar = () => {
    if (min <= 0 || max <= 0 || max < min) {
      setMensaje('Revisa el rango de peso (mínimo y máximo).');
      return;
    }
    const actualizado: ProcessData = { ...process, weightControl: control, updatedAt: new Date().toISOString() };
    const ok = ProcessStorageService.saveCurrentProcess(actualizado);
    if (ok) {
      onUpdateProcess(actualizado);
      AuditLog.registrar('Control de pesos', `${pesos.length} pesos · ${stats.pctConforme.toFixed(1)}% conforme`, process.processNumber);
      setMensaje('Control de pesos guardado.');
      setTimeout(() => setMensaje(null), 2500);
    } else {
      setMensaje('No se pudo guardar (almacenamiento lleno).');
    }
  };

  const conforme = stats.total > 0 && stats.pctConforme === 100;

  return (
    <div className="card-panel glow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Scale size={22} color="#34D399" />
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>Control de peso de cajas</h2>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '2px 0 0' }}>
              Pega la transcripción de los pesos registrados por el packing
            </p>
          </div>
        </div>
        {stats.total > 0 && (
          <div style={{
            background: conforme ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1.5px solid ${conforme ? '#10B981' : '#EF4444'}`,
            color: conforme ? '#34D399' : '#F87171',
            padding: '6px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.85rem'
          }}>
            {stats.pctConforme.toFixed(1)}% conforme
          </div>
        )}
      </div>

      {/* Formato y rango */}
      <div className="grid-3" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Formato de caja</label>
          <select className="form-select" value={formatId} onChange={e => setFormatId(e.target.value)}>
            {BOX_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Peso mínimo (kg)</label>
          <input type="number" step="0.001" inputMode="decimal" className="form-input" value={minKg} onChange={e => setMinKg(e.target.value)} placeholder="Ej. 10.150" />
        </div>
        <div className="form-group">
          <label className="form-label">Peso máximo (kg)</label>
          <input type="number" step="0.001" inputMode="decimal" className="form-input" value={maxKg} onChange={e => setMaxKg(e.target.value)} placeholder="Ej. 10.300" />
        </div>
      </div>

      {/* Pegado masivo */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="form-label" style={{ margin: 0 }}>Pesos registrados</label>
          <button type="button" className="btn-secondary" onClick={pegarDesdePortapapeles} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            <ClipboardPaste size={14} color="#34D399" />
            <span>Pegar</span>
          </button>
        </div>
        <textarea
          className="form-textarea"
          rows={4}
          placeholder={'Pega aquí los pesos, en cualquier formato:\n10.21  10.18  10.25  10.09\no separados por comas: 10,21; 10,18; 10,25'}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
        />
        {previsualizados.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#34D399', marginTop: '6px' }}>
            Se detectaron <strong>{previsualizados.length}</strong> pesos listos para agregar.
          </div>
        )}
        <button type="button" className="btn-primary" onClick={agregarPesos} disabled={previsualizados.length === 0} style={{ marginTop: '10px', opacity: previsualizados.length === 0 ? 0.5 : 1 }}>
          <Check size={18} />
          <span>Agregar {previsualizados.length > 0 ? `${previsualizados.length} pesos` : 'pesos'}</span>
        </button>
      </div>

      {mensaje && (
        <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid #059669', color: '#34D399', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '14px' }}>
          {mensaje}
        </div>
      )}

      {/* Estadísticas */}
      {stats.total > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: '12px' }}>
            <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Cajas pesadas</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34D399' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Promedio</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white' }}>{stats.promedio.toFixed(3)}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{stats.min.toFixed(3)} – {stats.max.toFixed(3)} kg</div>
            </div>
            <div style={{ background: '#0F172A', border: `1px solid ${conforme ? '#334155' : '#EF4444'}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Fuera de rango</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: conforme ? '#34D399' : '#EF4444' }}>
                {stats.bajoRango + stats.sobreRango}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                {stats.bajoRango} bajo · {stats.sobreRango} sobre
              </div>
            </div>
          </div>

          {!conforme && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertTriangle size={18} color="#F87171" />
              <span style={{ fontSize: '0.82rem', color: '#FCA5A5' }}>
                Hay cajas fuera del rango {min.toFixed(3)}–{max.toFixed(3)} kg. Verifica la calibración de la balanza o el llenado.
              </span>
            </div>
          )}

          {/* Listado de pesos */}
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '10px', marginBottom: '14px', maxHeight: '180px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {pesos.map((p, i) => {
                const fuera = p < min || p > max;
                return (
                  <span
                    key={i}
                    onClick={() => setPesos(prev => prev.filter((_, idx) => idx !== i))}
                    title="Tocar para quitar"
                    style={{
                      background: fuera ? 'rgba(239,68,68,0.15)' : '#1E293B',
                      border: `1px solid ${fuera ? '#EF4444' : '#334155'}`,
                      color: fuera ? '#F87171' : '#CBD5E1',
                      padding: '3px 9px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    {p.toFixed(3)}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={() => setPesos([])} style={{ flex: 1, justifyContent: 'center' }}>
              <Trash2 size={16} color="#EF4444" />
              <span>Limpiar todo</span>
            </button>
            <button type="button" className="btn-primary" onClick={guardar} style={{ flex: 2 }}>
              <Check size={18} />
              <span>Guardar control de pesos</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
