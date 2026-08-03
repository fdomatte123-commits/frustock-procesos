import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProcessFormScreen } from './components/ProcessFormScreen';
import { BoxSamplingScreen } from './components/BoxSamplingScreen';
import { ProcessSummaryScreen } from './components/ProcessSummaryScreen';
import { ProcessData } from './types/process';
import { ProcessStorageService } from './services/storage';
import { QRScannerService, QRPackingPayload } from './services/qrScanner';
import { QRScanPanel } from './components/QRScanPanel';

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'form' | 'sampling' | 'summary'>('form');
  const [activeProcess, setActiveProcess] = useState<ProcessData | null>(null);
  const [isQROpen, setIsQROpen] = useState(false);
  const [qrPrefill, setQrPrefill] = useState<Partial<ProcessData> | null>(null);

  useEffect(() => {
    // Load active process if stored offline
    const loaded = ProcessStorageService.getCurrentProcess();
    if (loaded) {
      setActiveProcess(loaded);
    }
  }, []);

  const handleProcessSaved = (process: ProcessData) => {
    setActiveProcess(process);
    setCurrentStep('sampling');
  };

  const handleUpdateProcess = (updated: ProcessData) => {
    setActiveProcess(updated);
  };

  // Iniciar un proceso nuevo desde cero (borra el activo local)
  const handleNewProcess = () => {
    if (activeProcess && activeProcess.boxes.length > 0) {
      const ok = window.confirm('¿Iniciar un proceso nuevo? Asegúrate de haber generado el PDF: los datos del proceso actual se borrarán de este dispositivo.');
      if (!ok) return;
    }
    ProcessStorageService.clearCurrentProcess();
    setActiveProcess(null);
    setCurrentStep('form');
  };

  // Lectura de etiqueta QR: prellena los datos del proceso
  const handleQRApply = (payload: QRPackingPayload) => {
    const datos = QRScannerService.toProcessData(payload);
    setQrPrefill(datos);
    setCurrentStep('form');
  };

  return (
    <div className="app-viewport">
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
        activeProcess={activeProcess}
        onSimulateQRScan={() => setIsQROpen(true)}
        onNewProcess={handleNewProcess}
      />

      {isQROpen && (
        <QRScanPanel onClose={() => setIsQROpen(false)} onApply={handleQRApply} />
      )}

      <main className="content-wrapper">
        {currentStep === 'form' && (
          <ProcessFormScreen
            initialData={activeProcess}
            qrPrefill={qrPrefill}
            onSaveAndProceed={handleProcessSaved}
          />
        )}

        {currentStep === 'sampling' && activeProcess && (
          <BoxSamplingScreen
            process={activeProcess}
            onUpdateProcess={handleUpdateProcess}
            onGoToSummary={() => setCurrentStep('summary')}
          />
        )}

        {currentStep === 'summary' && activeProcess && (
          <ProcessSummaryScreen
            process={activeProcess}
            onBackToSampling={() => setCurrentStep('sampling')}
          />
        )}
      </main>

      <footer style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #1E293B' }}>
        FRUSTOCK Procesos v1.0 • Control de Calidad Frutícola • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
