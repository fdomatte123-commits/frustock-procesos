import React from 'react';
import { ClipboardList, Box, FileText, QrCode, FilePlus2 } from 'lucide-react';
import { ProcessData } from '../types/process';

interface HeaderProps {
  currentStep: 'form' | 'sampling' | 'summary';
  onSelectStep: (step: 'form' | 'sampling' | 'summary') => void;
  activeProcess: ProcessData | null;
  onSimulateQRScan: () => void;
  onNewProcess: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onSelectStep,
  activeProcess,
  onSimulateQRScan,
  onNewProcess
}) => {
  const boxCount = activeProcess?.boxes ? activeProcess.boxes.length : 0;

  return (
    <header>
      <div className="app-header">
        <div className="brand-badge">
          <div className="brand-logo">FRUSTOCK</div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F8FAFC' }}>Procesos</div>
            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Packing Quality Control</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Nuevo Proceso */}
          <button
            onClick={onNewProcess}
            title="Iniciar un proceso nuevo"
            style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #F59E0B', color: '#F59E0B', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <FilePlus2 size={16} />
            <span className="hide-mobile">Nuevo</span>
          </button>

          {/* QR Scanner Roadmap Button (Phase 2) */}
          <button
            onClick={onSimulateQRScan}
            title="Escanear Código QR de Etiqueta Packing (Fase 2)"
            style={{
              background: 'rgba(5, 150, 105, 0.15)',
              border: '1px solid #059669',
              color: '#34D399',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            <QrCode size={16} />
            <span className="hide-mobile">Escáner QR</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="step-navigation">
        <button
          className={`step-tab ${currentStep === 'form' ? 'active' : ''}`}
          onClick={() => onSelectStep('form')}
        >
          <ClipboardList size={16} />
          <span>1. Datos Proceso</span>
        </button>

        <button
          className={`step-tab ${currentStep === 'sampling' ? 'active' : ''} ${!activeProcess ? 'disabled' : ''}`}
          onClick={() => activeProcess && onSelectStep('sampling')}
          disabled={!activeProcess}
        >
          <Box size={16} />
          <span>2. Muestreo</span>
          {boxCount > 0 && <span className="badge-counter">{boxCount}</span>}
        </button>

        <button
          className={`step-tab ${currentStep === 'summary' ? 'active' : ''} ${boxCount === 0 ? 'disabled' : ''}`}
          onClick={() => boxCount > 0 && onSelectStep('summary')}
          disabled={boxCount === 0}
        >
          <FileText size={16} />
          <span>3. Reporte PDF</span>
        </button>
      </div>
    </header>
  );
};
