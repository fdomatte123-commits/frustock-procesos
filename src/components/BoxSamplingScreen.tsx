import React, { useState, useMemo } from 'react';
import { Camera, Plus, Trash2, CheckCircle2, AlertOctagon, FileText, Image as ImageIcon, Check, X, ShieldAlert } from 'lucide-react';
import {
  ProcessData,
  BoxSampling,
  DefectItem,
  ORANGE_CALIBERS,
  ORANGE_COLOR_SCALE,
  ORANGE_DEFECTS_LIST,
  BoxStatus,
  GENERAL_TOLERANCES
} from '../types/process';
import { ProcessStorageService } from '../services/storage';

interface BoxSamplingScreenProps {
  process: ProcessData;
  onUpdateProcess: (updated: ProcessData) => void;
  onGoToSummary: () => void;
}

export const BoxSamplingScreen: React.FC<BoxSamplingScreenProps> = ({
  process,
  onUpdateProcess,
  onGoToSummary
}) => {
  const currentBoxNumber = (process.boxes ? process.boxes.length : 0) + 1;
  const isExtraFancy = process.exportCategory === 'EXTRA-FANCY';

  // 1. Caliber State
  const [selectedCaliberIndex, setSelectedCaliberIndex] = useState<number>(6); // Calibre 88 default

  // 2. Color Grade State (Escala 1 al 8)
  const [selectedColorGrade, setSelectedColorGrade] = useState<number>(1); // 1. Naranjo Intenso

  // 3. Photos
  const [photos, setPhotos] = useState<string[]>([]);

  // 4. Defects
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number>(0);
  const [defectValue, setDefectValue] = useState<number>(5);

  // 5. Notes
  const [notes, setNotes] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // -------------------------------------------------------------
  // MOTOR DE EVALUACIÓN AUTOMÁTICA (APROBADA VS OBJETADA)
  // -------------------------------------------------------------
  const evaluationResult = useMemo(() => {
    const reasons: string[] = [];
    let status: BoxStatus = 'APROBADA';

    const maxCalidad = isExtraFancy ? GENERAL_TOLERANCES.maxTotalCalidadExtraFancy : GENERAL_TOLERANCES.maxTotalCalidadFancy;
    const maxTotalCaja = isExtraFancy ? GENERAL_TOLERANCES.maxTotalCajaExtraFancy : GENERAL_TOLERANCES.maxTotalCajaFancy;

    let totalCalidadPct = 0;
    let totalCondicionPct = 0;

    defects.forEach(d => {
      if (d.type === 'calidad') totalCalidadPct += d.countOrPercentage;
      if (d.type === 'condicion') totalCondicionPct += d.countOrPercentage;

      const tolerance = isExtraFancy ? d.toleranceExtraFancy : d.toleranceFancy;

      // Regla de tolerancia individual por defecto
      if (d.countOrPercentage > tolerance) {
        status = 'OBJETADA';
        reasons.push(`Defecto "${d.name}" Excede Tolerancia (${d.countOrPercentage}% > máx ${tolerance}%)`);
      }

      // Regla específica: Desuniformidad de color > 10%
      if (d.name === 'Desuniformidad De Color' && d.countOrPercentage > 10) {
        status = 'OBJETADA';
        reasons.push('Desuniformidad de color mayor a 10% (Tolerancia máxima 10%)');
      }

      // Regla específica: Descalibre >= 10%
      if (d.name === 'Descalibre' && d.countOrPercentage >= 10) {
        status = 'OBJETADA';
        reasons.push('Descalibre mayor o igual al 10% de la muestra');
      }
    });

    const totalCajaPct = totalCalidadPct + totalCondicionPct;

    // Regla: Total Defectos de Calidad
    if (totalCalidadPct > maxCalidad) {
      status = 'OBJETADA';
      reasons.push(`Total Defectos Calidad Excede Límite (${totalCalidadPct}% > máx ${maxCalidad}% en ${process.exportCategory})`);
    }

    // Regla: Total Defectos en la Caja
    if (totalCajaPct > maxTotalCaja) {
      status = 'OBJETADA';
      reasons.push(`Total Defectos en Caja Excede Límite (${totalCajaPct}% > máx ${maxTotalCaja}% en ${process.exportCategory})`);
    }

    // Regla: Falta de color (Grado 4 o mayor si se indica)
    if (selectedColorGrade === 4) {
      // Color 4 es "Naranjo con visos verdes intensos" -> Falto de color
      reasons.push('Fruta en Grado 4: Clasificada como Falta de Color (Tolerancia max 5%)');
    }

    return {
      status,
      reasons,
      totalCalidadPct,
      totalCondicionPct,
      totalCajaPct
    };
  }, [defects, isExtraFancy, process.exportCategory, selectedColorGrade]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setPhotos(prev => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Synthetic Orange Photo Generator
  const handleGenerateOrangePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 400, 300);

      // Draw box border
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 360, 260);

      // Draw Orange Fruits
      const currentCal = ORANGE_CALIBERS[selectedCaliberIndex];
      const colorGradeObj = ORANGE_COLOR_SCALE.find(c => c.grade === selectedColorGrade);

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

      // Add watermark text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.fillText(`NARANJA ${process.variety} - CAL ${currentCal.caliber} (${evaluationResult.status})`, 28, 265);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhotos(prev => [...prev, dataUrl]);
    }
  };

  const handleAddDefect = () => {
    const defectDef = ORANGE_DEFECTS_LIST[selectedDefectIndex];
    if (!defectDef) return;

    // Check if already added
    const existingIndex = defects.findIndex(d => d.name === defectDef.name);
    if (existingIndex >= 0) {
      const updated = [...defects];
      updated[existingIndex].countOrPercentage = defectValue;
      setDefects(updated);
    } else {
      const newDefect: DefectItem = {
        id: crypto.randomUUID(),
        name: defectDef.name,
        category: defectDef.category,
        type: defectDef.type,
        countOrPercentage: defectValue,
        unit: defectDef.unit,
        toleranceExtraFancy: defectDef.toleranceExtraFancy,
        toleranceFancy: defectDef.toleranceFancy
      };
      setDefects(prev => [...prev, newDefect]);
    }
  };

  const handleRemoveDefect = (id: string) => {
    setDefects(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveAndAddNextBox = () => {
    const calObj = ORANGE_CALIBERS[selectedCaliberIndex];
    const colorObj = ORANGE_COLOR_SCALE.find(c => c.grade === selectedColorGrade);

    const newBox: BoxSampling = {
      id: crypto.randomUUID(),
      boxNumber: currentBoxNumber,
      caliber: `Calibre ${calObj.caliber}`,
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

    const updatedProcess = ProcessStorageService.addBoxToCurrentProcess(newBox);
    if (updatedProcess) {
      onUpdateProcess(updatedProcess);
      showNotification(`✓ Caja #${currentBoxNumber} (${newBox.status}) guardada exitosamente.`);

      // Reset for next box
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

  const activeCaliber = ORANGE_CALIBERS[selectedCaliberIndex];

  return (
    <div>
      {/* Active Process Sticky Summary */}
      <div style={{ background: '#1E293B', border: '1px solid #059669', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 800 }}>
            PROCESO NARANJA #{process.processNumber}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
            {process.variety} • Categoría <span style={{ color: isExtraFancy ? '#34D399' : '#F59E0B' }}>{process.exportCategory}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
            Productor: {process.producerName} | Lote: {process.lot} | CSG: {process.csg}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399' }}>
            {process.boxes ? process.boxes.length : 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>CAJAS EVALUADAS</div>
        </div>
      </div>

      {/* Main Inspection Card */}
      <div className="card-panel glow">
        {/* Header & Status Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#059669', color: 'white', fontWeight: 800, fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px' }}>
              CAJA N° {currentBoxNumber}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Inspección Naranja</h3>
          </div>

          {/* DYNAMIC EVALUATION BADGE (APROBADA / OBJETADA) */}
          <div style={{
            background: evaluationResult.status === 'APROBADA' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1.5px solid ${evaluationResult.status === 'APROBADA' ? '#10B981' : '#EF4444'}`,
            color: evaluationResult.status === 'APROBADA' ? '#34D399' : '#F87171',
            padding: '6px 16px',
            borderRadius: '20px',
            fontWeight: 800,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {evaluationResult.status === 'APROBADA' ? <Check size={18} /> : <AlertOctagon size={18} />}
            <span>CAJA {evaluationResult.status}</span>
          </div>
        </div>

        {/* Evaluation Warning Box if OBJETADA */}
        {evaluationResult.status === 'OBJETADA' && evaluationResult.reasons.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F87171', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              <ShieldAlert size={18} />
              <span>Caja Objetada según Tolerancias Norma Naranja:</span>
            </div>
            <ul style={{ margin: '0 0 0 20px', fontSize: '0.8rem', color: '#FCA5A5' }}>
              {evaluationResult.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 1. TABLA DE CALIBRES NARANJA (Tabla 4.2.1) */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label">Calibre Naranja (Tabla 4.2.1) *</label>
            <span style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 700 }}>
              Diámetro: <strong>{activeCaliber.diameterMm} mm</strong> | Peso: <strong>{activeCaliber.weightGr} g</strong>
            </span>
          </div>

          <div className="caliber-grid">
            {ORANGE_CALIBERS.map((calSpec, index) => (
              <div
                key={calSpec.caliber}
                className={`caliber-chip ${selectedCaliberIndex === index ? 'selected' : ''}`}
                onClick={() => setSelectedCaliberIndex(index)}
              >
                <div>Cal {calSpec.caliber}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>{calSpec.diameterMm} mm</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. TABLA DE COLORES NARANJA (Tabla 5.1.1) */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Color de la Muestra (Tabla 5.1.1 FRUSTOCK)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginTop: '8px' }}>
            {ORANGE_COLOR_SCALE.map((col) => (
              <div
                key={col.grade}
                onClick={() => setSelectedColorGrade(col.grade)}
                style={{
                  background: selectedColorGrade === col.grade ? 'rgba(5, 150, 105, 0.25)' : '#0F172A',
                  border: `1.5px solid ${selectedColorGrade === col.grade ? '#34D399' : '#334155'}`,
                  borderRadius: '8px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: col.hex, border: '1px solid white', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>Grado {col.grade}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', lineHeight: '1.1' }}>
                    {col.grade === 4 ? 'Falto de Color (5%)' : col.name.split('.')[1]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. FOTOGRAFÍAS DE LA CAJA */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Fotografías de la Caja / Frutos ({photos.length})</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <label className="btn-secondary" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
              <Camera size={18} color="#34D399" />
              <span>Tomar / Subir Foto</span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
            </label>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleGenerateOrangePhoto}
            >
              <ImageIcon size={18} color="#F59E0B" />
              <span>Foto Demo Naranja</span>
            </button>
          </div>

          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map((img, idx) => (
                <div key={idx} className="photo-thumb">
                  <img src={img} alt={`Foto ${idx + 1}`} />
                  <button
                    type="button"
                    className="photo-delete-btn"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. DEFECTOS SEGÚN TABLA 4.3 (TOLERANCIAS EXTRA-FANCY & FANCY) */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label">Defectos Registrados (Tabla 4.3 FRUSTOCK)</label>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Tolerancia Máx Calidad: <strong style={{ color: '#34D399' }}>{isExtraFancy ? '7%' : '12%'}</strong> | Total Caja: <strong style={{ color: '#34D399' }}>{isExtraFancy ? '10%' : '12%'}</strong>
            </span>
          </div>

          {/* Add Defect Selector */}
          <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px' }}>
            <div className="grid-2" style={{ marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Seleccionar Defecto</span>
                <select
                  className="form-select"
                  value={selectedDefectIndex}
                  onChange={e => setSelectedDefectIndex(Number(e.target.value))}
                >
                  {ORANGE_DEFECTS_LIST.map((def, i) => (
                    <option key={i} value={i}>
                      [{def.type.toUpperCase()}] {def.name} (Tolerancia {isExtraFancy ? def.toleranceExtraFancy : def.toleranceFancy}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Porcentaje Encontrado (%)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={defectValue}
                    onChange={e => setDefectValue(Number(e.target.value))}
                    min="1"
                    max="100"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddDefect}
                    style={{ background: '#059669', borderColor: '#059669', color: 'white', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={18} />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Defects List */}
          {defects.length > 0 ? (
            <div>
              {defects.map(defect => {
                const tol = isExtraFancy ? defect.toleranceExtraFancy : defect.toleranceFancy;
                const isExceeded = defect.countOrPercentage > tol;

                return (
                  <div key={defect.id} className="defect-card" style={{ borderColor: isExceeded ? '#EF4444' : '#334155' }}>
                    <div>
                      <span className={`defect-badge ${defect.category}`}>{defect.type}</span>
                      <strong style={{ marginLeft: '10px', fontSize: '0.95rem', color: 'white' }}>{defect.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: '8px' }}>
                        (Max Tol: {tol}%)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontWeight: 800, color: isExceeded ? '#EF4444' : '#34D399', fontSize: '1rem' }}>
                        {defect.countOrPercentage} % {isExceeded ? '⚠️' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDefect(defect.id)}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#0F172A', border: '1px dashed #334155', borderRadius: '8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              Sin defectos agregados a esta caja de naranja.
            </div>
          )}
        </div>

        {/* 5. OBSERVACIONES DEL INSPECTOR */}
        <div className="form-group">
          <label className="form-label">Observaciones del Inspector</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Ej. Fruta bien cepillada, buena simetría, leve presencia de ombligo cicatrizado..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAndAddNextBox}
            style={{ flex: 2 }}
          >
            <CheckCircle2 size={20} />
            <span>Guardar Caja ({evaluationResult.status}) y Siguiente</span>
          </button>

          {process.boxes && process.boxes.length > 0 && (
            <button
              type="button"
              className="btn-primary btn-accent"
              onClick={onGoToSummary}
              style={{ flex: 1 }}
            >
              <FileText size={20} />
              <span>Finalizar y PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* HISTORIAL DE CAJAS EVALUADAS */}
      {process.boxes && process.boxes.length > 0 && (
        <div className="card-panel">
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cajas Inspeccionadas ({process.boxes.length})</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>1 Página PDF por Caja</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {process.boxes.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#0F172A',
                  border: `1px solid ${b.status === 'APROBADA' ? '#334155' : '#EF4444'}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#34D399', fontSize: '0.95rem' }}>Caja #{b.boxNumber}</strong>
                    <span style={{ color: 'white', fontWeight: 700 }}>{b.caliber} ({b.diameterMm})</span>
                    <span style={{
                      background: b.status === 'APROBADA' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: b.status === 'APROBADA' ? '#34D399' : '#F87171',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}>
                      {b.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    Fotos: {b.photos.length} | Defectos: {b.defects.length} {b.colorName ? `| Color: ${b.colorName.split('.')[0]}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteBoxFromSession(b.id)}
                  style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                  title="Eliminar caja"
                >
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
