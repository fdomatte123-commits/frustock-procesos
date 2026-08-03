import React, { useState, useMemo, useEffect } from 'react';
import { Camera, Plus, Trash2, CheckCircle2, AlertOctagon, FileText, Image as ImageIcon, Check, ShieldAlert } from 'lucide-react';
import {
  ProcessData,
  BoxSampling,
  DefectItem,
  CITRUS_COLOR_SCALE,
  BoxStatus,
  CaliberProgram,
  getCalibers,
  getDefectsList,
  getTolerance,
  getMaxCalidad,
  getMaxTotalCaja
} from '../types/process';
import { ProcessStorageService, compressImage } from '../services/storage';

interface BoxSamplingScreenProps {
  process: ProcessData;
  onUpdateProcess: (updated: ProcessData) => void;
  onGoToSummary: () => void;
}

// Límite de fotos por caja: protege la cuota de almacenamiento del dispositivo
const MAX_FOTOS_POR_CAJA = 4;

export const BoxSamplingScreen: React.FC<BoxSamplingScreenProps> = ({
  process,
  onUpdateProcess,
  onGoToSummary
}) => {
  const currentBoxNumber = (process.boxes ? process.boxes.length : 0) + 1;
  const isMandarin = process.species === 'Mandarina';

  // Programa de calibres (solo mandarina ofrece Costco)
  const [program, setProgram] = useState<CaliberProgram>('NORMAL');

  const calibers = useMemo(() => getCalibers(process.species, program), [process.species, program]);
  const defectsList = useMemo(() => getDefectsList(process.species), [process.species]);

  const [selectedCaliberIndex, setSelectedCaliberIndex] = useState<number>(0);
  const [selectedColorGrade, setSelectedColorGrade] = useState<number>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number>(0);
  const [defectValue, setDefectValue] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Al cambiar de programa/especie, reajustar índices que podrían quedar fuera de rango
  useEffect(() => {
    setSelectedCaliberIndex(0);
  }, [program, process.species]);

  useEffect(() => {
    if (selectedDefectIndex >= defectsList.length) setSelectedDefectIndex(0);
  }, [defectsList, selectedDefectIndex]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // -------------------------------------------------------------
  // MOTOR DE EVALUACIÓN AUTOMÁTICA (APROBADA VS OBJETADA)
  // -------------------------------------------------------------
  const evaluationResult = useMemo(() => {
    const reasons: string[] = [];
    let status: BoxStatus = 'APROBADA';

    const maxCalidad = getMaxCalidad(process.species, process.exportCategory);
    const maxTotalCaja = getMaxTotalCaja(process.species, process.exportCategory);

    let totalCalidadPct = 0;
    let totalCondicionPct = 0;

    defects.forEach(d => {
      if (d.type === 'calidad') totalCalidadPct += d.countOrPercentage;
      if (d.type === 'condicion') totalCondicionPct += d.countOrPercentage;

      const tolerance = getTolerance(d, process.exportCategory);
      if (d.countOrPercentage > tolerance) {
        status = 'OBJETADA';
        reasons.push(`Defecto "${d.name}" excede tolerancia (${d.countOrPercentage}% > máx ${tolerance}%)`);
      }
    });

    const totalCajaPct = totalCalidadPct + totalCondicionPct;

    if (totalCalidadPct > maxCalidad) {
      status = 'OBJETADA';
      reasons.push(`Total defectos de calidad excede el límite (${totalCalidadPct}% > máx ${maxCalidad}% en ${process.exportCategory})`);
    }
    if (totalCajaPct > maxTotalCaja) {
      status = 'OBJETADA';
      reasons.push(`Total defectos en la caja excede el límite (${totalCajaPct}% > máx ${maxTotalCaja}% en ${process.exportCategory})`);
    }

    // Reglas de color (tabla de colores): grado 5 = defecto; 6-8 = fruta no embalable
    const colorObj = CITRUS_COLOR_SCALE.find(c => c.grade === selectedColorGrade);
    if (colorObj && colorObj.isDefect) {
      status = 'OBJETADA';
      if (selectedColorGrade === 5) {
        reasons.push('Color grado 5: sobre 21% de visos verdes intensos, calificada como defecto');
      } else {
        reasons.push(`Color grado ${selectedColorGrade} (${colorObj.name}): FRUTA NO EMBALABLE`);
      }
    } else if (selectedColorGrade === 4) {
      reasons.push('Color grado 4: en el límite (visos verdes suaves). Termina de virar en viaje.');
    }

    return { status, reasons, totalCalidadPct, totalCondicionPct, totalCajaPct };
  }, [defects, process.species, process.exportCategory, selectedColorGrade]);

  // Foto: comprimir antes de guardar (evita reventar la cuota local)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    // Tope por caja: sin límite, la cuota del dispositivo se agota sin aviso
    if (photos.length + e.target.files.length > MAX_FOTOS_POR_CAJA) {
      showNotification(`Máximo ${MAX_FOTOS_POR_CAJA} fotos por caja (llevas ${photos.length}).`);
      e.target.value = '';
      return;
    }

    setIsCompressing(true);
    try {
      const files = Array.from(e.target.files);
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImage(file);
        setPhotos(prev => [...prev, compressed]);
      }
    } catch (err) {
      console.error('Error al procesar la foto:', err);
      showNotification('No se pudo procesar una foto.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleGenerateDemoPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 400, 300);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 360, 260);
    const currentCal = calibers[selectedCaliberIndex];
    const colorGradeObj = CITRUS_COLOR_SCALE.find(c => c.grade === selectedColorGrade);
    for (let i = 0; i < 12; i++) {
      const x = 70 + (i % 4) * 85;
      const y = 70 + Math.floor(i / 4) * 80;
      ctx.beginPath();
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.fillStyle = colorGradeObj ? colorGradeObj.hex : '#FF9800';
      ctx.fill();
      ctx.strokeStyle = '#FFF3E0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillText(`${process.species} ${process.variety} - CAL ${currentCal?.caliber} (${evaluationResult.status})`, 26, 265);
    setPhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
  };

  const handleAddDefect = () => {
    const defectDef = defectsList[selectedDefectIndex];
    if (!defectDef) return;
    const valor = Number.isFinite(defectValue) ? defectValue : 0;

    setDefects(prev => {
      const existingIndex = prev.findIndex(d => d.name === defectDef.name);
      if (existingIndex >= 0) {
        // Inmutable: crear objeto nuevo en vez de mutar el del estado
        return prev.map((d, i) => i === existingIndex ? { ...d, countOrPercentage: valor } : d);
      }
      const newDefect: DefectItem = {
        id: crypto.randomUUID(),
        name: defectDef.name,
        category: defectDef.category,
        type: defectDef.type,
        countOrPercentage: valor,
        unit: defectDef.unit,
        toleranceExtraFancy: defectDef.toleranceExtraFancy,
        toleranceFancy: defectDef.toleranceFancy,
        toleranceFancyLatam: defectDef.toleranceFancyLatam
      };
      return [...prev, newDefect];
    });
  };

  const handleRemoveDefect = (id: string) => {
    setDefects(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveAndAddNextBox = () => {
    const calObj = calibers[selectedCaliberIndex];
    if (!calObj) return;
    const colorObj = CITRUS_COLOR_SCALE.find(c => c.grade === selectedColorGrade);

    const newBox: BoxSampling = {
      id: crypto.randomUUID(),
      boxNumber: currentBoxNumber,
      program: isMandarin ? program : undefined,
      caliber: `Calibre ${calObj.caliber}`,
      caliberLabel: calObj.costcoLabel,
      diameterMm: `${calObj.diameterMm} mm`,
      weightGr: `${calObj.weightGr} gr`,
      colorGrade: selectedColorGrade,
      colorName: colorObj?.name,
      status: evaluationResult.status,
      statusReasons: evaluationResult.reasons,
      photos: [...photos],
      defects: [...defects],
      notes: notes.trim(),
      timestamp: new Date().toISOString()
    };

    const result = ProcessStorageService.addBoxToCurrentProcess(newBox);
    if (result === 'QUOTA') {
      showNotification('⚠ Almacenamiento lleno. Genera el PDF y reinicia el proceso, o reduce las fotos por caja.');
      return;
    }
    if (result) {
      onUpdateProcess(result);
      showNotification(`✓ Caja #${currentBoxNumber} (${newBox.status}) guardada.`);
      setPhotos([]);
      setDefects([]);
      setNotes('');
    }
  };

  const handleDeleteBoxFromSession = (boxId: string) => {
    const updated = ProcessStorageService.deleteBoxFromProcess(boxId);
    if (updated) {
      onUpdateProcess(updated);
      showNotification('Caja eliminada.');
    }
  };

  const activeCaliber = calibers[selectedCaliberIndex];
  const maxCalidadDisplay = getMaxCalidad(process.species, process.exportCategory);
  const maxCajaDisplay = getMaxTotalCaja(process.species, process.exportCategory);

  return (
    <div>
      {/* Resumen del proceso activo */}
      <div style={{ background: '#1E293B', border: '1px solid #059669', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 800 }}>
            PROCESO {process.species.toUpperCase()} #{process.processNumber}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
            {process.variety} • Categoría <span style={{ color: process.exportCategory === 'EXTRA-FANCY' ? '#34D399' : '#F59E0B' }}>{process.exportCategory}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
            Productor: {process.producerName} | Lote: {process.lot} | CSG: {process.csg}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399' }}>{process.boxes ? process.boxes.length : 0}</div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>CAJAS EVALUADAS</div>
        </div>
      </div>

      <div className="card-panel glow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#059669', color: 'white', fontWeight: 800, fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px' }}>CAJA N° {currentBoxNumber}</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Inspección {process.species}</h3>
          </div>
          <div style={{
            background: evaluationResult.status === 'APROBADA' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1.5px solid ${evaluationResult.status === 'APROBADA' ? '#10B981' : '#EF4444'}`,
            color: evaluationResult.status === 'APROBADA' ? '#34D399' : '#F87171',
            padding: '6px 16px', borderRadius: '20px', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {evaluationResult.status === 'APROBADA' ? <Check size={18} /> : <AlertOctagon size={18} />}
            <span>CAJA {evaluationResult.status}</span>
          </div>
        </div>

        {evaluationResult.status === 'OBJETADA' && evaluationResult.reasons.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F87171', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              <ShieldAlert size={18} />
              <span>Caja objetada según tolerancias:</span>
            </div>
            <ul style={{ margin: '0 0 0 20px', fontSize: '0.8rem', color: '#FCA5A5' }}>
              {evaluationResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {/* Programa Costco (solo mandarina) */}
        {isMandarin && (
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Programa de Calibres</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setProgram('NORMAL')}
                style={{ flex: 1, justifyContent: 'center', ...(program === 'NORMAL' ? { background: '#059669', borderColor: '#059669', color: 'white' } : {}) }}
              >
                Normal (Tabla estándar)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setProgram('COSTCO')}
                style={{ flex: 1, justifyContent: 'center', ...(program === 'COSTCO' ? { background: '#D97706', borderColor: '#D97706', color: 'white' } : {}) }}
              >
                Programa Costco
              </button>
            </div>
          </div>
        )}

        {/* Calibres */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label">Calibre {process.species} {isMandarin && program === 'COSTCO' ? '(Costco)' : ''} *</label>
            {activeCaliber && (
              <span style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 700 }}>
                Diámetro: <strong>{activeCaliber.diameterMm} mm</strong> | Peso: <strong>{activeCaliber.weightGr} g</strong>
              </span>
            )}
          </div>
          <div className="caliber-grid">
            {calibers.map((calSpec, index) => (
              <div
                key={`${calSpec.costcoLabel || ''}-${calSpec.caliber}`}
                className={`caliber-chip ${selectedCaliberIndex === index ? 'selected' : ''}`}
                onClick={() => setSelectedCaliberIndex(index)}
              >
                <div>{calSpec.costcoLabel ? `${calSpec.costcoLabel} · ${calSpec.caliber}` : `Cal ${calSpec.caliber}`}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>{calSpec.diameterMm} mm</div>
              </div>
            ))}
          </div>
          {activeCaliber?.isSpecialOrder && (
            <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: '8px' }}>
              ⚠ Calibre de pedido especial: no se embala salvo solicitud expresa del encargado FRUSTOCK.
            </div>
          )}
        </div>

        {/* Color */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Color de la Muestra (Tabla de Colores)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginTop: '8px' }}>
            {CITRUS_COLOR_SCALE.map((col) => (
              <div
                key={col.grade}
                onClick={() => setSelectedColorGrade(col.grade)}
                style={{
                  background: selectedColorGrade === col.grade ? 'rgba(5, 150, 105, 0.25)' : '#0F172A',
                  border: `1.5px solid ${selectedColorGrade === col.grade ? '#34D399' : (col.embalable ? '#334155' : '#7F1D1D')}`,
                  borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: col.hex, border: '1px solid white', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>Grado {col.grade}</div>
                  <div style={{ fontSize: '0.63rem', color: col.embalable ? '#94A3B8' : '#F87171', lineHeight: '1.1' }}>
                    {col.embalable ? col.name : 'NO EMBALABLE'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fotos */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Fotografías de la Caja / Frutos ({photos.length}/{MAX_FOTOS_POR_CAJA})</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <label className="btn-secondary" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', opacity: isCompressing ? 0.6 : 1 }}>
              <Camera size={18} color="#34D399" />
              <span>{isCompressing ? 'Procesando...' : 'Tomar / Subir Foto'}</span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </label>
            <button type="button" className="btn-secondary" onClick={handleGenerateDemoPhoto}>
              <ImageIcon size={18} color="#F59E0B" />
              <span>Foto Demo</span>
            </button>
          </div>
          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map((img, idx) => (
                <div key={idx} className="photo-thumb">
                  <img src={img} alt={`Foto ${idx + 1}`} />
                  <button type="button" className="photo-delete-btn" onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Defectos */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label">Defectos Registrados</label>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Máx Calidad: <strong style={{ color: '#34D399' }}>{maxCalidadDisplay}%</strong> | Total Caja: <strong style={{ color: '#34D399' }}>{maxCajaDisplay}%</strong>
            </span>
          </div>

          <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px' }}>
            <div className="grid-2" style={{ marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Seleccionar Defecto</span>
                <select className="form-select" value={selectedDefectIndex} onChange={e => setSelectedDefectIndex(Number(e.target.value))}>
                  {defectsList.map((def, i) => (
                    <option key={i} value={i}>[{def.type.toUpperCase()}] {def.name} (Tol {getTolerance(def, process.exportCategory)}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Porcentaje Encontrado (%)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" className="form-input" value={defectValue} onChange={e => setDefectValue(Number(e.target.value))} min="0" max="100" />
                  <button type="button" className="btn-secondary" onClick={handleAddDefect} style={{ background: '#059669', borderColor: '#059669', color: 'white', whiteSpace: 'nowrap' }}>
                    <Plus size={18} /><span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {defects.length > 0 ? (
            <div>
              {defects.map(defect => {
                const tol = getTolerance(defect, process.exportCategory);
                const isExceeded = defect.countOrPercentage > tol;
                return (
                  <div key={defect.id} className="defect-card" style={{ borderColor: isExceeded ? '#EF4444' : '#334155' }}>
                    <div>
                      <span className={`defect-badge ${defect.category}`}>{defect.type}</span>
                      <strong style={{ marginLeft: '10px', fontSize: '0.95rem', color: 'white' }}>{defect.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: '8px' }}>(Max Tol: {tol}%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontWeight: 800, color: isExceeded ? '#EF4444' : '#34D399', fontSize: '1rem' }}>{defect.countOrPercentage} % {isExceeded ? '⚠️' : ''}</span>
                      <button type="button" onClick={() => handleRemoveDefect(defect.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#0F172A', border: '1px dashed #334155', borderRadius: '8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              Sin defectos agregados a esta caja.
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Observaciones del Inspector</label>
          <textarea className="form-textarea" rows={2} placeholder="Ej. Fruta bien cepillada, buena simetría..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <button type="button" className="btn-primary" onClick={handleSaveAndAddNextBox} style={{ flex: 2 }}>
            <CheckCircle2 size={20} />
            <span>Guardar Caja ({evaluationResult.status}) y Siguiente</span>
          </button>
          {process.boxes && process.boxes.length > 0 && (
            <button type="button" className="btn-primary btn-accent" onClick={onGoToSummary} style={{ flex: 1 }}>
              <FileText size={20} />
              <span>Finalizar y PDF</span>
            </button>
          )}
        </div>
      </div>

      {process.boxes && process.boxes.length > 0 && (
        <div className="card-panel">
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cajas Inspeccionadas ({process.boxes.length})</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>1 Página PDF por Caja</span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {process.boxes.map((b) => (
              <div key={b.id} style={{ background: '#0F172A', border: `1px solid ${b.status === 'APROBADA' ? '#334155' : '#EF4444'}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#34D399', fontSize: '0.95rem' }}>Caja #{b.boxNumber}</strong>
                    <span style={{ color: 'white', fontWeight: 700 }}>{b.caliber}{b.caliberLabel ? ` (${b.caliberLabel})` : ''} ({b.diameterMm})</span>
                    {b.program && <span style={{ fontSize: '0.65rem', color: b.program === 'COSTCO' ? '#F59E0B' : '#94A3B8', fontWeight: 700 }}>{b.program}</span>}
                    <span style={{ background: b.status === 'APROBADA' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: b.status === 'APROBADA' ? '#34D399' : '#F87171', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>{b.status}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    Fotos: {b.photos.length} | Defectos: {b.defects.length} {b.colorName ? `| Color: G${b.colorGrade}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => handleDeleteBoxFromSession(b.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }} title="Eliminar caja">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast-notification">
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
