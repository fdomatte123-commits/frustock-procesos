import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProcessFormScreen } from './components/ProcessFormScreen';
import { BoxSamplingScreen } from './components/BoxSamplingScreen';
import { ProcessSummaryScreen } from './components/ProcessSummaryScreen';
import { WeightControlScreen } from './components/WeightControlScreen';
import { AccessGate } from './components/AccessGate';
import { ProcessData } from './types/process';
import { ProcessStorageService } from './services/storage';
import { QRScannerService, QRPackingPayload } from './services/qrScanner';
import { QRScanPanel } from './components/QRScanPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionService, AuditLog } from './services/session';

export type Step = 'form' | 'sampling' | 'weights' | 'summary';

export const App: React.FC = () => {
  const [autorizado, setAutorizado] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('form');
  const [activeProcess, setActiveProcess] = useState<ProcessData | null>(null);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [qrPrefill, setQrPrefill] = useState<Partial<ProcessData> | null>(null);

  useEffect(() => {
    if (!autorizado) return;
    const loaded = ProcessStorageService.getCurrentProcess();
    if (loaded) setActiveProcess(loaded);
  }, [autorizado]);

  const handleProcessSaved = (process: ProcessData) => {
    // Firmar el proceso con el inspector de la jornada
    const firmado: ProcessData = { ...process, inspector: process.inspector || SessionService.inspector() };
    ProcessStorageService.saveCurrentProcess(firmado);
    setActiveProcess(firmado);
    AuditLog.registrar('Proceso guardado', `Proceso ${firmado.processNumber} · ${firmado.species}`, firmado.processNumber);
    setCurrentStep('sampling');
  };

  const handleUpdateProcess = (updated: ProcessData) => {
    setActiveProcess(updated);
  };

  const handleNewProcess = () => {
    if (activeProcess && activeProcess.boxes.length > 0) {
      const ok = window.confirm('¿Iniciar un proceso nuevo? Asegúrate de haber generado el PDF: los datos del proceso actual se borrarán de este dispositivo.');
      if (!ok) return;
    }
    AuditLog.registrar('Proceso cerrado', `Se inició un proceso nuevo`, activeProcess?.processNumber);
    ProcessStorageService.clearCurrentProcess();
    setActiveProcess(null);
    setCurrentStep('form');
  };

  const handleQRApply = (payload: QRPackingPayload) => {
    const datos = QRScannerService.toProcessData(payload);
    setQrPrefill(datos);
    AuditLog.registrar('Lectura QR', `Etiqueta leída · proceso ${datos.processNumber ?? 's/n'}`);
    setCurrentStep('form');
  };

  if (!autorizado) {
    return <AccessGate onReady={() => setAutorizado(true)} />;
  }

  return (
    <div className="app-viewport">
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
        activeProcess={activeProcess}
        onSimulateQRScan={() => setIsQROpen(true)}
        onNewProcess={handleNewProcess}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isQROpen && (
        <QRScanPanel onClose={() => setIsQROpen(false)} onApply={handleQRApply} />
      )}

      {isSettingsOpen && (
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
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

        {currentStep === 'weights' && activeProcess && (
          <WeightControlScreen
            process={activeProcess}
            onUpdateProcess={handleUpdateProcess}
          />
        )}

        {currentStep === 'summary' && activeProcess && (
          <ProcessSummaryScreen
            process={activeProcess}
            onUpdateProcess={handleUpdateProcess}
            onBackToSampling={() => setCurrentStep('sampling')}
          />
        )}
      </main>

      <footer style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #1E293B' }}>
        FRUSTOCK Procesos · Inspector: <strong style={{ color: '#94A3B8' }}>{SessionService.inspector() || '—'}</strong> · {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
