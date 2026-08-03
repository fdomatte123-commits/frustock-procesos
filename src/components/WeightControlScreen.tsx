import React, { useState, useMemo } from 'react';
import { Scale, ClipboardPaste, Trash2, Check, AlertTriangle, Plus, Package } from 'lucide-react';
import {
  ProcessData, WeightControl, WeightGroup,
  parsearPesosDetallado, calcularEstadisticasPeso, calcularEstadisticasGrupo,
  rangoPesoCalibre, pesosPlanos, getCalibers,
  NETO_OBJETIVO_DEFECTO, TARA_DEFECTO
} from '../types/process';
import { ProcessStorageService } from '../services/storage';
import { AuditLog } from '../services/session';

interface Props {
  process: ProcessData;
  onUpdateProcess: (p: ProcessData) => void;
}

/**
 * Control de peso de cajas del packing.
 *
 * Sigue la estructura de la planilla de papel: los pesos se anotan agrupados
 * por calibre y por línea de embalaje. Evaluar cada bloque contra su propio
 * rango es lo que permite detectar una línea descalibrada; el promedio del
 * turno completo la esconde.
 */
export const WeightControlScreen: React.FC<Props> = ({ process, onUpdateProcess }) => {
  const wc = process.weightControl;

  const [neto, setNeto] = useState<string>(String(wc?.netoObjetivoKg ?? NETO_OBJETIVO_DEFECTO));
  const [tara, setTara] = useState<string>(String(wc?.taraKg ?? TARA_DEFECTO));
  const [grupos, setGrupos] = useState<WeightGroup[]>(() => {
    if (wc?.grupos?.length) return wc.grupos;
    // Proceso guardado antes de agrupar por calibre: se conserva en un bloque
    if (wc?.weights?.length) {
      return [{ id: crypto.randomUUID(), caliber: 'Sin calibre', weights: [...wc.weights] }];
    }
    return [];
  });
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);

  const netoNum = parseFloat(neto.replace(',', '.'));
  const taraNum = parseFloat(tara.replace(',', '.'));
  const netoOk = Number.isFinite(netoNum) && netoNum > 0;
  const taraOk = Number.isFinite(taraNum) && taraNum >= 0;
  const minBruto = netoOk && taraOk ? netoNum + taraNum : 0;

  const calibresDisponibles = useMemo(
    () => getCalibers(process.species, 'NORMAL'),
    [process.species]
  );

  const avisar = (m: string, ms = 3500) => {
    setMensaje(m);
    setTimeout(() => setMensaje(null), ms);
  };

  // ---------------- Grupos ----------------

  const agregarGrupo = () => {
    const usados = new Set(grupos.map(g => `${g.caliber}|${g.line ?? ''}`));
    const libre = calibresDisponibles.find(c => !usados.has(`${c.caliber}|`));
    setGrupos(prev => [...prev, {
      id: crypto.randomUUID(),
      caliber: libre?.caliber ?? calibresDisponibles[0]?.caliber ?? '',
      weights: []
    }]);
  };

  const actualizarGrupo = (id: string, cambios: Partial<WeightGroup>) => {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, ...cambios } : g));
  };

  const eliminarGrupo = (id: string) => {
    setGrupos(prev => prev.filter(g => g.id !== id));
    setTextos(prev => { const c = { ...prev }; delete c[id]; return c; });
  };

  const agregarPesos = (g: WeightGroup) => {
    const rango = rangoPesoCalibre(process.species, g.caliber, netoNum, taraNum);
    const lectura = parsearPesosDetallado(textos[g.id] ?? '', { minKg: rango.min, maxKg: rango.max });
    if (lectura.pesos.length === 0) {
      avisar('No se reconocieron pesos en el texto pegado.');
      return;
    }
    actualizarGrupo(g.id, { weights: [...g.weights, ...lectura.pesos] });
    setTextos(prev => ({ ...prev, [g.id]: '' }));
    const aviso = lectura.descartados.length > 0
      ? ` Se ignoraron ${lectura.descartados.length}: ${lectura.descartados.join(', ')}.`
      : '';
    avisar(`Calibre ${g.caliber}: ${lectura.pesos.length} peso(s) agregado(s).${aviso}`, 5000);
  };

  const pegarEn = async (id: string) => {
    try {
      const t = await navigator.clipboard.readText();
      setTextos(prev => ({ ...prev, [id]: t }));
    } catch {
      avisar('No se pudo leer el portapapeles. Pega el texto manualmente.');
    }
  };

  // ---------------- Cálculos ----------------

  const statsPorGrupo = useMemo(
    () => grupos.map(g => calcularEstadisticasGrupo(g, process.species, netoNum, taraNum)),
    [grupos, process.species, netoNum, taraNum]
  );

  const todos = useMemo(() => pesosPlanos(grupos), [grupos]);

  const resumen = useMemo(() => {
    const total = todos.length;
    const bajo = statsPorGrupo.reduce((s, x) => s + x.bajoRango, 0);
    const sobre = statsPorGrupo.reduce((s, x) => s + x.sobreRango, 0);
    const prom = total > 0 ? todos.reduce((a, b) => a + b, 0) / total : 0;
    return {
      total, bajo, sobre,
      conformes: total - bajo - sobre,
      pct: total > 0 ? ((total - bajo - sobre) / total) * 100 : 0,
      promedioBruto: prom,
      promedioNeto: prom - (taraOk ? taraNum : 0)
    };
  }, [todos, statsPorGrupo, taraNum, taraOk]);

  /** Bloques con menos del 70% conforme: los que hay que ir a revisar */
  const criticos = statsPorGrupo.filter(s => s.total >= 3 && s.pctConforme < 70);

  const control: WeightControl = useMemo(() => ({
    formatLabel: `${process.species} · neto ${netoOk ? netoNum.toFixed(3) : '—'} kg + tara ${taraOk ? taraNum.toFixed(3) : '—'} kg`,
    minKg: minBruto,
    maxKg: statsPorGrupo.length > 0 ? Math.max(...statsPorGrupo.map(s => s.rangoMax)) : 0,
    weights: todos,
    grupos,
    netoObjetivoKg: netoNum,
    taraKg: taraNum,
    updatedAt: new Date().toISOString()
  }), [process.species, netoNum, taraNum, netoOk, taraOk, minBruto, statsPorGrupo, todos, grupos]);

  const guardar = () => {
    if (!netoOk || !taraOk) { avisar('Revisa el neto objetivo y la tara.'); return; }
    if (todos.length === 0) { avisar('Agrega al menos un peso antes de guardar.'); return; }
    const actualizado: ProcessData = { ...process, weightControl: control, updatedAt: new Date().toISOString() };
    if (ProcessStorageService.saveCurrentProcess(actualizado)) {
      onUpdateProcess(actualizado);
      AuditLog.registrar(
        'Control de pesos',
        `${resumen.total} cajas en ${grupos.length} calibres · ${resumen.pct.toFixed(1)}% conforme · tara ${taraNum.toFixed(3)} kg`,
        process.processNumber
      );
      avisar('Control de pesos guardado.');
    } else {
      avisar('No se pudo guardar (almacenamiento lleno).');
    }
  };

  const colorPct = (p: number) => p >= 90 ? '#34D399' : p >= 70 ? '#FBBF24' : '#F87171';

  return (
    <div className="card-panel glow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Scale size={22} color="#34D399" />
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>Control de peso de cajas</h2>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '2px 0 0' }}>
              Un bloque por calibre, igual que la planilla del packing
            </p>
          </div>
        </div>
        {resumen.total > 0 && (
          <div style={{
            background: 'rgba(15,23,42,0.6)', border: `1.5px solid ${colorPct(resumen.pct)}`,
            color: colorPct(resumen.pct), padding: '6px 14px', borderRadius: '20px',
            fontWeight: 800, fontSize: '0.85rem'
          }}>
            {resumen.pct.toFixed(1)}% conforme
          </div>
        )}
      </div>

      {/* Parámetros del proceso: tara y neto objetivo */}
      <div style={{
        background: 'rgba(245,158,11,0.07)', border: '1px solid #F59E0B', borderRadius: '12px',
        padding: '14px', marginBottom: '18px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Package size={18} color="#F59E0B" />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#E2E8F0' }}>
            Referencia de peso de este proceso
          </span>
        </div>
        <div className="grid-2" style={{ gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Peso de la caja vacía · tara (kg)</label>
            <input
              type="text" inputMode="decimal" className="form-input"
              value={tara}
              onChange={e => setTara(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="0.850"
              style={{ fontWeight: 700, fontSize: '1.05rem' }}
            />
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>
              Pesa una caja armada y vacía. Todo el cálculo depende de este número.
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Neto que debe salir del packing (kg)</label>
            <input
              type="text" inputMode="decimal" className="form-input"
              value={neto}
              onChange={e => setNeto(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="15.300"
              style={{ fontWeight: 700, fontSize: '1.05rem' }}
            />
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>
              Lo que marca la etiqueta más el margen de merma en tránsito.
            </div>
          </div>
        </div>
        <div style={{
          marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(245,158,11,0.3)',
          fontSize: '0.8rem', color: '#FBBF24', fontWeight: 700
        }}>
          {netoOk && taraOk
            ? <>Peso bruto mínimo para toda caja: <strong style={{ fontSize: '1rem' }}>{minBruto.toFixed(3)} kg</strong>
                <span style={{ color: '#94A3B8', fontWeight: 500 }}> · el máximo sube en cada calibre según el peso de un fruto</span></>
            : 'Completa la tara y el neto objetivo para poder evaluar los pesos.'}
        </div>
      </div>

      {mensaje && (
        <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid #059669', color: '#34D399', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '14px' }}>
          {mensaje}
        </div>
      )}

      {/* Bloques por calibre */}
      {grupos.map((g, i) => {
        const s = statsPorGrupo[i];
        const texto = textos[g.id] ?? '';
        const lectura = parsearPesosDetallado(texto, { minKg: s.rangoMin, maxKg: s.rangoMax });
        return (
          <div key={g.id} style={{
            background: '#0F172A', border: `1px solid ${s.total > 0 ? colorPct(s.pctConforme) : '#334155'}`,
            borderRadius: '12px', padding: '14px', marginBottom: '12px'
          }}>
            {/* Cabecera del bloque */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ minWidth: '110px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block', marginBottom: '3px' }}>Calibre</span>
                <select
                  className="form-select"
                  value={g.caliber}
                  onChange={e => actualizarGrupo(g.id, { caliber: e.target.value })}
                >
                  {!calibresDisponibles.some(c => c.caliber === g.caliber) && (
                    <option value={g.caliber}>{g.caliber}</option>
                  )}
                  {calibresDisponibles.map(c => (
                    <option key={c.caliber} value={c.caliber}>{c.caliber}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: '92px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block', marginBottom: '3px' }}>Línea</span>
                <input
                  type="text" className="form-input" value={g.line ?? ''}
                  onChange={e => actualizarGrupo(g.id, { line: e.target.value || undefined })}
                  placeholder="ej. x"
                  style={{ textAlign: 'center' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px', fontSize: '0.72rem', color: '#94A3B8' }}>
                Rango: <strong style={{ color: '#CBD5E1' }}>{s.rangoMin.toFixed(3)} – {s.rangoMax.toFixed(3)}</strong> kg
                {s.pesoFruto != null && <span> · 1 fruto = {(s.pesoFruto * 1000).toFixed(0)} g</span>}
              </div>
              <button
                type="button" onClick={() => eliminarGrupo(g.id)}
                style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '6px' }}
                title="Quitar este calibre"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Pegado */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <textarea
                className="form-textarea" rows={2} value={texto}
                onChange={e => setTextos(prev => ({ ...prev, [g.id]: e.target.value }))}
                placeholder={`Pesos del calibre ${g.caliber}: 16,325  16,370  16,220…`}
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button type="button" className="btn-secondary" onClick={() => pegarEn(g.id)} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                  <ClipboardPaste size={14} color="#34D399" />
                </button>
                <button
                  type="button" className="btn-secondary"
                  onClick={() => agregarPesos(g)}
                  disabled={lectura.pesos.length === 0}
                  style={{
                    padding: '6px 10px', fontSize: '0.72rem', whiteSpace: 'nowrap',
                    background: '#059669', borderColor: '#059669', color: 'white',
                    opacity: lectura.pesos.length === 0 ? 0.4 : 1
                  }}
                >
                  <Plus size={14} /><span>{lectura.pesos.length || ''}</span>
                </button>
              </div>
            </div>
            {lectura.descartados.length > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#FBBF24', marginBottom: '6px' }}>
                Se ignorarán {lectura.descartados.length} valor(es) imposibles: {lectura.descartados.join(', ')}
              </div>
            )}

            {/* Resultados del bloque */}
            {s.total > 0 && (
              <>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '8px' }}>
                  <span><strong style={{ color: 'white' }}>{s.total}</strong> cajas</span>
                  <span>prom. <strong style={{ color: 'white' }}>{s.promedio.toFixed(3)}</strong> kg</span>
                  <span>neto <strong style={{ color: 'white' }}>{(s.promedio - (taraOk ? taraNum : 0)).toFixed(3)}</strong> kg</span>
                  {s.bajoRango > 0 && <span style={{ color: '#F87171' }}>{s.bajoRango} bajo mín.</span>}
                  {s.sobreRango > 0 && <span style={{ color: '#FBBF24' }}>{s.sobreRango} sobre máx.</span>}
                  <span style={{ marginLeft: 'auto', color: colorPct(s.pctConforme), fontWeight: 800 }}>
                    {s.pctConforme.toFixed(0)}% conforme
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                  {g.weights.map((p, idx) => {
                    const bajo = p < s.rangoMin, sobre = p > s.rangoMax;
                    const col = bajo ? '#F87171' : sobre ? '#FBBF24' : '#CBD5E1';
                    return (
                      <span
                        key={idx}
                        onClick={() => actualizarGrupo(g.id, { weights: g.weights.filter((_, k) => k !== idx) })}
                        title="Tocar para quitar"
                        style={{
                          background: '#1E293B', border: `1px solid ${bajo || sobre ? col : '#334155'}`,
                          color: col, padding: '2px 8px', borderRadius: '12px',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {p.toFixed(3)}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      <button type="button" className="btn-secondary" onClick={agregarGrupo}
        style={{ width: '100%', justifyContent: 'center', marginBottom: '16px' }}>
        <Plus size={18} color="#34D399" />
        <span>Agregar calibre</span>
      </button>

      {/* Resumen del turno */}
      {resumen.total > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: '12px' }}>
            <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Cajas pesadas</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34D399' }}>{resumen.total}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>en {grupos.length} calibres</div>
            </div>
            <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Neto promedio</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white' }}>{resumen.promedioNeto.toFixed(3)}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>bruto {resumen.promedioBruto.toFixed(3)} kg</div>
            </div>
            <div style={{ background: '#0F172A', border: `1px solid ${colorPct(resumen.pct)}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Fuera de rango</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: colorPct(resumen.pct) }}>{resumen.bajo + resumen.sobre}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{resumen.bajo} bajo · {resumen.sobre} sobre</div>
            </div>
          </div>

          {criticos.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <AlertTriangle size={18} color="#F87171" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FCA5A5' }}>
                  Calibres que hay que revisar en la línea
                </span>
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, fontSize: '0.8rem', color: '#FCA5A5' }}>
                {criticos.map((c, i) => (
                  <li key={i} style={{ marginBottom: '2px' }}>
                    Calibre {c.caliber}{c.line ? ` línea ${c.line}` : ''}: {c.pctConforme.toFixed(0)}% conforme
                    {c.bajoRango > c.sobreRango
                      ? ` — ${c.bajoRango} cajas bajo el mínimo (está llenando poco)`
                      : ` — ${c.sobreRango} cajas sobre el máximo (está regalando fruta)`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={() => setGrupos([])} style={{ flex: 1, justifyContent: 'center' }}>
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
