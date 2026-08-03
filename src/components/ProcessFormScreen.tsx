import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  ProcessData, ExportCategory, Species, MaturityReading,
  getCategoriasDisponibles, getMaturityParams, evaluarMadurez
} from '../types/process';
import { ProcessStorageService } from '../services/storage';

interface ProcessFormScreenProps {
  initialData: ProcessData | null;
  qrPrefill?: Partial<ProcessData> | null;
  onSaveAndProceed: (data: ProcessData) => void;
}

export const ProcessFormScreen: React.FC<ProcessFormScreenProps> = ({
  initialData,
  qrPrefill,
  onSaveAndProceed
}) => {
  const [formData, setFormData] = useState<Partial<ProcessData>>(() => {
    return initialData || ProcessStorageService.createInitialProcess();
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [maturityValues, setMaturityValues] = useState<Record<string, string>>({});

  const maturityParams = getMaturityParams((formData.species as Species) || 'Naranja');

  // Al cargar un proceso existente, recuperar sus lecturas de madurez
  useEffect(() => {
    if (initialData?.maturity?.length) {
      const vals: Record<string, string> = {};
      initialData.maturity.forEach(m => { vals[m.key] = String(m.value); });
      setMaturityValues(vals);
    }
  }, [initialData]);

  // Datos leídos desde el QR de la etiqueta: sobrescriben solo los campos que trae
  useEffect(() => {
    if (qrPrefill && Object.keys(qrPrefill).length > 0) {
      setFormData(prev => ({ ...prev, ...qrPrefill }));
      setErrors({});
    }
  }, [qrPrefill]);

  const handleChange = (field: keyof ProcessData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAutoFillDemo = () => {
    const mock = ProcessStorageService.createInitialProcess({
      processNumber: `PROC-NAR-${Math.floor(1000 + Math.random() * 9000)}`,
      species: 'Naranja' as Species,
      variety: 'Fukumoto',
      exportCategory: 'EXTRA-FANCY',
      producerCode: 'P-9920',
      producerName: 'Agrícola Los Naranjos',
      csg: '104820',
      sdp: 'SDP-02',
      receptionDate: new Date().toISOString().split('T')[0],
      lot: 'LOTE-NAR-04',
      totalKg: 24500
    });
    setFormData(mock);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.processNumber?.trim()) newErrors.processNumber = 'Requerido';
    if (!formData.species?.trim()) newErrors.species = 'Requerido';
    if (!formData.variety?.trim()) newErrors.variety = 'Requerido';
    if (!formData.producerCode?.trim()) newErrors.producerCode = 'Requerido';
    if (!formData.producerName?.trim()) newErrors.producerName = 'Requerido';
    if (!formData.csg?.trim()) newErrors.csg = 'Requerido';
    if (!formData.sdp?.trim()) newErrors.sdp = 'Requerido';
    if (!formData.receptionDate?.trim()) newErrors.receptionDate = 'Requerido';
    if (!formData.lot?.trim()) newErrors.lot = 'Requerido';
    if (!formData.totalKg || formData.totalKg <= 0) newErrors.totalKg = 'Ingrese Kg válidos';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Lecturas de madurez ingresadas (solo las que tienen valor numérico)
    const maturity: MaturityReading[] = maturityParams
      .map(p => {
        const v = parseFloat(maturityValues[p.key] ?? '');
        if (!Number.isFinite(v)) return null;
        return { key: p.key, label: p.label, value: v, unit: p.unit, ok: evaluarMadurez(p, v) };
      })
      .filter((m): m is MaturityReading => m !== null);

    const completedProcess: ProcessData = {
      id: formData.id || crypto.randomUUID(),
      processNumber: formData.processNumber!,
      species: formData.species || 'Naranja',
      maturity,
      variety: formData.variety!,
      exportCategory: (formData.exportCategory as ExportCategory) || 'EXTRA-FANCY',
      producerCode: formData.producerCode!,
      producerName: formData.producerName!,
      csg: formData.csg!,
      sdp: formData.sdp!,
      receptionDate: formData.receptionDate!,
      lot: formData.lot!,
      totalKg: Number(formData.totalKg!),
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      boxes: formData.boxes || []
    };

    ProcessStorageService.saveCurrentProcess(completedProcess);
    onSaveAndProceed(completedProcess);
  };

  return (
    <div className="card-panel glow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList color="#059669" size={24} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>Datos del Proceso</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
            Pantalla 1: Datos de Recepción e Inspección (Norma Naranja FRUSTOCK)
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={handleAutoFillDemo}
          title="Autocompletar formulario con datos de ejemplo"
        >
          <Sparkles size={16} color="#F59E0B" />
          <span>Ejemplo Demo Naranja</span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          {/* Número de Proceso */}
          <div className="form-group">
            <label className="form-label">Número de Proceso *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. PROC-NAR-2026-089"
              value={formData.processNumber || ''}
              onChange={e => handleChange('processNumber', e.target.value)}
            />
            {errors.processNumber && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.processNumber}</span>}
          </div>

          {/* Especie */}
          <div className="form-group">
            <label className="form-label">Especie Frutícola *</label>
            <select
              className="form-select"
              value={formData.species || 'Naranja'}
              onChange={e => {
                const nuevaEsp = e.target.value as Species;
                handleChange('species', nuevaEsp);
                // Al cambiar de especie, ajustar la categoría a una válida para esa norma
                const cats = getCategoriasDisponibles(nuevaEsp);
                handleChange('exportCategory', cats[0].value);
              }}
            >
              <option value="Naranja">Naranja (norma 4.2 / 4.3)</option>
              <option value="Mandarina">Mandarina / Clementina (normal y Costco)</option>
              <option value="Limón">Limón (Choice / Fancy / E-Fancy)</option>
              <option value="Palta">Palta Hass (USA / Europa)</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          {/* Variedad */}
          <div className="form-group">
            <label className="form-label">Variedad *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Fukumoto, Lane Late, Cara Cara, Navel"
              value={formData.variety || ''}
              onChange={e => handleChange('variety', e.target.value)}
            />
            {errors.variety && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.variety}</span>}
          </div>

          {/* Categoría de Exportación */}
          <div className="form-group">
            <label className="form-label">Categoría de Embalaje *</label>
            <select
              className="form-select"
              value={formData.exportCategory || 'EXTRA-FANCY'}
              onChange={e => handleChange('exportCategory', e.target.value)}
              style={{ fontWeight: 800, color: '#34D399' }}
            >
              {getCategoriasDisponibles((formData.species as Species) || 'Naranja').map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}{c.hint ? ` — ${c.hint}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          {/* Código Productor */}
          <div className="form-group">
            <label className="form-label">Código Productor *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. P-8820"
              value={formData.producerCode || ''}
              onChange={e => handleChange('producerCode', e.target.value)}
            />
            {errors.producerCode && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.producerCode}</span>}
          </div>

          {/* Productor */}
          <div className="form-group">
            <label className="form-label">Nombre del Productor *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Agrícola San Fernando"
              value={formData.producerName || ''}
              onChange={e => handleChange('producerName', e.target.value)}
            />
            {errors.producerName && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.producerName}</span>}
          </div>
        </div>

        <div className="grid-3">
          {/* CSG */}
          <div className="form-group">
            <label className="form-label">CSG (Código SAG) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. 104820"
              value={formData.csg || ''}
              onChange={e => handleChange('csg', e.target.value)}
            />
            {errors.csg && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.csg}</span>}
          </div>

          {/* SDP */}
          <div className="form-group">
            <label className="form-label">SDP (Sitio Inspección) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. SDP-02"
              value={formData.sdp || ''}
              onChange={e => handleChange('sdp', e.target.value)}
            />
            {errors.sdp && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.sdp}</span>}
          </div>

          {/* Fecha de Recepción */}
          <div className="form-group">
            <label className="form-label">Fecha Recepción *</label>
            <input
              type="date"
              className="form-input"
              value={formData.receptionDate || ''}
              onChange={e => handleChange('receptionDate', e.target.value)}
            />
            {errors.receptionDate && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.receptionDate}</span>}
          </div>
        </div>

        <div className="grid-2">
          {/* Lote */}
          <div className="form-group">
            <label className="form-label">Número / Código de Lote *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. LOTE-NAR-04"
              value={formData.lot || ''}
              onChange={e => handleChange('lot', e.target.value)}
            />
            {errors.lot && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.lot}</span>}
          </div>

          {/* Kg Totales */}
          <div className="form-group">
            <label className="form-label">Kilos Totales (Kg) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="Ej. 24500"
              value={formData.totalKg || ''}
              onChange={e => handleChange('totalKg', e.target.value)}
            />
            {errors.totalKg && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.totalKg}</span>}
          </div>
        </div>

        {/* PARÁMETROS DE MADUREZ (según la norma de cada especie) */}
        {maturityParams.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
            <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>
              Parámetros de madurez del lote <span style={{ color: '#64748B', fontWeight: 400 }}>(opcional)</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '10px' }}>
              Criterios de aceptación de la norma {formData.species}. Se incluyen en el informe PDF.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
              {maturityParams.map(param => {
                const valorTxt = maturityValues[param.key] ?? '';
                const num = parseFloat(valorTxt);
                const tieneValor = valorTxt !== '' && Number.isFinite(num);
                const cumple = tieneValor ? evaluarMadurez(param, num) : null;
                const borde = cumple === null ? '#334155' : (cumple ? '#059669' : '#EF4444');

                return (
                  <div key={param.key} style={{ background: '#0F172A', border: `1px solid ${borde}`, borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E2E8F0' }}>{param.label}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{param.unit}</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      className="form-input"
                      placeholder="—"
                      value={valorTxt}
                      onChange={e => setMaturityValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                      style={{ marginBottom: '4px' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: cumple === false ? '#F87171' : '#64748B', lineHeight: 1.35 }}>
                      {cumple === false ? '⚠ Fuera de norma · ' : ''}{param.help}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <button type="submit" className="btn-primary">
            <CheckCircle2 size={20} />
            <span>Guardar Proceso e Iniciar Muestreo de Cajas</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};
