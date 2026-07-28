import React, { useState } from 'react';
import { Box, Camera, Plus, Trash2, CheckCircle2, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import { ProcessData, BoxSampling, DefectItem, CALIBER_PRESETS, COMMON_DEFECT_PRESETS, DefectSeverity } from '../types/process';
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

  const [selectedCaliber, setSelectedCaliber] = useState<string>('Calibre 88');
  const [customCaliber, setCustomCaliber] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Selected defect addition state
  const [selectedDefectPresetIndex, setSelectedDefectPresetIndex] = useState<number>(0);
  const [defectCountOrPct, setDefectCountOrPct] = useState<number>(5);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Add sample fruit photo generator / File upload handler
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

  // Generate synthetic sample photo for instant offline testing
  const handleGenerateSamplePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw fruit packing canvas background
      ctx.fillStyle = '#0F291E';
      ctx.fillRect(0, 0, 400, 300);

      // Draw fruit box grid mock
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 360, 260);

      // Draw cherries / fruit circles
      const colors = ['#DC2626', '#991B1B', '#B91C1C', '#7F1D1D'];
      for (let i = 0; i < 18; i++) {
        const x = 50 + (i % 6) * 60;
        const y = 60 + Math.floor(i / 6) * 70;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#FEE2E2';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Stem line
        ctx.beginPath();
        ctx.moveTo(x, y - 20);
        ctx.lineTo(x + 10, y - 38);
        ctx.strokeStyle = '#65A30D';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Add box label watermark
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillText(`FRUSTOCK CAJA #${currentBoxNumber} - ${selectedCaliber}`, 30, 265);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhotos(prev => [...prev, dataUrl]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDefect = () => {
    const preset = COMMON_DEFECT_PRESETS[selectedDefectPresetIndex];
    if (!preset) return;

    const newDefect: DefectItem = {
      id: crypto.randomUUID(),
      name: preset.name,
      category: preset.category as DefectSeverity,
      countOrPercentage: defectCountOrPct,
      unit: preset.unit as '%' | 'unidades'
    };

    setDefects(prev => [...prev, newDefect]);
  };

  const handleRemoveDefect = (id: string) => {
    setDefects(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveAndAddNextBox = () => {
    const finalCaliber = selectedCaliber === 'Otro' && customCaliber.trim()
      ? customCaliber.trim()
      : selectedCaliber;

    const newBox: BoxSampling = {
      id: crypto.randomUUID(),
      boxNumber: currentBoxNumber,
      caliber: finalCaliber,
      photos: [...photos],
      defects: [...defects],
      notes: notes.trim(),
      timestamp: new Date().toISOString()
    };

    const updatedProcess = ProcessStorageService.addBoxToCurrentProcess(newBox);
    if (updatedProcess) {
      onUpdateProcess(updatedProcess);
      showNotification(`✓ Caja #${currentBoxNumber} guardada exitosamente.`);

      // Reset box form state for next box
      setPhotos([]);
      setDefects([]);
      setNotes('');
    }
  };

  const handleDeleteBoxFromSession = (boxId: string) => {
    const updated = ProcessStorageService.deleteBoxFromProcess(boxId);
    if (updated) {
      onUpdateProcess(updated);
      showNotification('Caja eliminada del registro.');
    }
  };

  return (
    <div>
      {/* Active Process Sticky Summary */}
      <div style={{ background: '#1E293B', border: '1px solid #059669', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 800, textTransform: uppercase('Proceso en curso') }}>
            PROCESO #{process.processNumber}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
            {process.variety} • {process.producerName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
            Lote: {process.lot} | CSG: {process.csg}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399' }}>
            {process.boxes ? process.boxes.length : 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>CAJAS REGISTRADAS</div>
        </div>
      </div>

      {/* Main Inspection Form Card */}
      <div className="card-panel glow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#059669', color: 'white', fontWeight: 800, fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px' }}>
              CAJA N° {currentBoxNumber}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Muestreo de Calidad</h3>
          </div>
        </div>

        {/* 1. SELECCIÓN DE CALIBRE */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Calibre de la Caja *</label>
          <div className="caliber-grid">
            {CALIBER_PRESETS.map(cal => (
              <div
                key={cal}
                className={`caliber-chip ${selectedCaliber === cal ? 'selected' : ''}`}
                onClick={() => setSelectedCaliber(cal)}
              >
                {cal}
              </div>
            ))}
          </div>
        </div>

        {/* 2. REGISTRO FOTOGRÁFICO DE LA CAJA */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Fotografías de la Caja / Fruta ({photos.length})</label>

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
              onClick={handleGenerateSamplePhoto}
              title="Generar foto simulada de inspección de fruta"
            >
              <ImageIcon size={18} color="#F59E0B" />
              <span>Foto Demo</span>
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
                    onClick={() => handleRemovePhoto(idx)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. REGISTRO DE DEFECTOS ENCONTRADOS */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Registro de Defectos Encontrados ({defects.length})</label>

          {/* Add Defect Row */}
          <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px' }}>
            <div className="grid-2" style={{ marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Tipo de Defecto</span>
                <select
                  className="form-select"
                  value={selectedDefectPresetIndex}
                  onChange={e => setSelectedDefectPresetIndex(Number(e.target.value))}
                >
                  {COMMON_DEFECT_PRESETS.map((preset, i) => (
                    <option key={i} value={i}>
                      [{preset.category.toUpperCase()}] {preset.name} ({preset.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Porcentaje / Valor</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={defectCountOrPct}
                    onChange={e => setDefectCountOrPct(Number(e.target.value))}
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

          {/* Added Defects List */}
          {defects.length > 0 ? (
            <div>
              {defects.map(defect => (
                <div key={defect.id} className="defect-card">
                  <div>
                    <span className={`defect-badge ${defect.category}`}>{defect.category}</span>
                    <strong style={{ marginLeft: '10px', fontSize: '0.95rem', color: 'white' }}>{defect.name}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontWeight: 800, color: '#34D399', fontSize: '1rem' }}>
                      {defect.countOrPercentage} {defect.unit}
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
              ))}
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#0F172A', border: '1px dashed #334155', borderRadius: '8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              Sin defectos registrados aún en esta caja.
            </div>
          )}
        </div>

        {/* 4. OBSERVACIONES DE LA CAJA */}
        <div className="form-group">
          <label className="form-label">Observaciones Opcionales</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Ej. Fruta firme, buena coloración, ligera presencia de roces de ramas..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* BOTONES DE ACCIÓN: GUARDAR Y AGREGAR NUEVA CAJA */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAndAddNextBox}
            style={{ flex: 2 }}
          >
            <CheckCircle2 size={20} />
            <span>Guardar y Agregar Nueva Caja</span>
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

      {/* HISTORIAL DE CAJAS EVALUADAS EN ESTA SESIÓN */}
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
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ color: '#34D399', fontSize: '0.95rem' }}>Caja #{b.boxNumber}</strong>
                  <span style={{ marginLeft: '12px', color: 'white', fontWeight: 700 }}>{b.caliber}</span>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                    Fotos: {b.photos.length} | Defectos: {b.defects.length}
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

function uppercase(str: string) {
  return str.toUpperCase();
}
