import React, { useState } from 'react';
import { FileText, Download, CheckCircle2, AlertCircle, ArrowLeft, Layers, ShieldCheck, Box } from 'lucide-react';
import { ProcessData } from '../types/process';
import { PDFReportGenerator } from '../services/pdfGenerator';

interface ProcessSummaryScreenProps {
  process: ProcessData;
  onBackToSampling: () => void;
}

export const ProcessSummaryScreen: React.FC<ProcessSummaryScreenProps> = ({
  process,
  onBackToSampling
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const totalBoxes = process.boxes ? process.boxes.length : 0;

  // Compute stats
  const calibresCount: Record<string, number> = {};
  let totalDefectsCount = 0;

  if (process.boxes) {
    process.boxes.forEach(b => {
      calibresCount[b.caliber] = (calibresCount[b.caliber] || 0) + 1;
      totalDefectsCount += b.defects.length;
    });
  }

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      setProgress(5);
      setErrorMessage(null);
      setSuccessMessage(null);

      await PDFReportGenerator.generateProcessPDF(process, (p) => {
        setProgress(p);
      });

      setSuccessMessage(`✓ Reporte PDF de ${totalBoxes} páginas generado y descargado correctamente.`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al generar el PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card-panel glow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText color="#34D399" size={24} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>Resumen del Informe PDF</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
            Módulo de exportación: 1 página maquetada por cada caja muestreada
          </p>
        </div>

        <button type="button" className="btn-secondary" onClick={onBackToSampling}>
          <ArrowLeft size={16} />
          <span>Volver a Muestreo</span>
        </button>
      </div>

      {/* PDF Rule Highlight Banner */}
      <div style={{ background: 'rgba(5, 150, 105, 0.12)', border: '1.5px solid #059669', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <ShieldCheck size={32} color="#34D399" />
        <div>
          <strong style={{ color: '#34D399', fontSize: '0.95rem', display: 'block' }}>
            REGLA DE ORO CUMPLIDA: 1 PÁGINA POR CAJA
          </strong>
          <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>
            El documento PDF generado constará exactamente de <strong>{totalBoxes} páginas</strong> (1 página independiente por caja con ficha técnica, calibres, defectos y galería fotográfica).
          </span>
        </div>
      </div>

      {/* General Stats Grid */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Cajas Evaluadas</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>{totalBoxes}</div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Total páginas a generar</span>
        </div>

        <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Calibres Distintos</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
            {Object.keys(calibresCount).length}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Distribución de calibres</span>
        </div>

        <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Defectos Totales</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: totalDefectsCount > 0 ? '#EF4444' : '#10B981', marginTop: '4px' }}>
            {totalDefectsCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>En el muestreo global</span>
        </div>
      </div>

      {/* Caliber breakdown list */}
      <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', marginBottom: '10px' }}>
          Distribución de Calibres por Caja
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(calibresCount).map(([cal, count]) => (
            <span
              key={cal}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                color: '#CBD5E1',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              {cal}: <strong style={{ color: '#34D399' }}>{count} caja(s)</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Progress Bar during generation */}
      {isGenerating && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#34D399', fontWeight: 700, marginBottom: '6px' }}>
            <span>Generando documento PDF...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: '#0F172A', borderRadius: '5px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #059669, #34D399)', transition: 'width 0.2s ease' }} />
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#F87171', padding: '14px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#34D399', padding: '14px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Download Button */}
      <button
        type="button"
        className="btn-primary"
        onClick={handleDownloadPDF}
        disabled={isGenerating}
        style={{ opacity: isGenerating ? 0.7 : 1, padding: '16px' }}
      >
        <Download size={22} />
        <span>{isGenerating ? 'Compilando PDF Multipágina...' : `Descargar Informe PDF (${totalBoxes} Páginas)`}</span>
      </button>
    </div>
  );
};
