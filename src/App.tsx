import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProcessFormScreen } from './components/ProcessFormScreen';
import { BoxSamplingScreen } from './components/BoxSamplingScreen';
import { ProcessSummaryScreen } from './components/ProcessSummaryScreen';
import { ProcessData } from './types/process';
import { ProcessStorageService } from './services/storage';
import { QRScannerService } from './services/qrScanner';

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'form' | 'sampling' | 'summary'>('form');
  const [activeProcess, setActiveProcess] = useState<ProcessData | null>(null);

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

  // Phase 2 Roadmap: Simulated QR Code Scan Handler
  const handleSimulateQRScan = () => {
    const mockQRRaw = "FRUSTOCK|CAL:Calibre 56|LOT:LOTE-2026-QR|PROD:PR-9900|SN:TAG-88219";
    const parsed = QRScannerService.parsePackingTag(mockQRRaw);

    alert(`[FASE 2 - ESCÁNER QR DE ETIQUETA]\n\nLectura simulación QR packing:\n` +
      `• Calibre: ${parsed.caliber}\n` +
      `• Lote: ${parsed.lot}\n` +
      `• Código Productor: ${parsed.producerCode}\n` +
      `• Serie Caja: ${parsed.boxSerial}\n\n` +
      `Módulo desacoplado listo para integrar la cámara nativa.`);
  };

  return (
    <div className="app-viewport">
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
        activeProcess={activeProcess}
        onSimulateQRScan={handleSimulateQRScan}
      />

      <main className="content-wrapper">
        {currentStep === 'form' && (
          <ProcessFormScreen
            initialData={activeProcess}
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
