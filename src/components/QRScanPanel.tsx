import React, { useState } from 'react';
import { QrCode, X, Check, ClipboardPaste } from 'lucide-react';
import { QRScannerService, QRPackingPayload } from '../services/qrScanner';

interface Props {
  onClose: () => void;
  onApply: (payload: QRPackingPayload) => void;
}

/**
 * Panel de lectura de etiquetas de packing.
 * El operario escanea el QR con la cámara del teléfono, y pega aquí el contenido.
 * Al integrar una cámara nativa (Fase 2), solo hay que alimentar `setTexto`.
 */
export const QRScanPanel: React.FC<Props> = ({ onClose, onApply }) => {
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState<QRPackingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analizar = (valor: string) => {
    setTexto(valor);
    setError(null);
    if (!valor.trim()) { setPreview(null); return; }

    const parsed = QRScannerService.parsePackingTag(valor);
    if (QRScannerService.tieneDatos(parsed)) {
      setPreview(parsed);
    } else {
      setPreview(null);
      setError('No se reconocieron datos de etiqueta en ese contenido.');
    }
  };

  const pegarDesdePortapapeles = async () => {
    try {
      const t = await navigator.clipboard.readText();
      analizar(t);
    } catch {
      setError('No se pudo leer el portapapeles. Pega el contenido manualmente.');
    }
  };

  const fila = (label: string, valor?: string) => valor ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1E293B' }}>
      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{label}</span>
      <strong style={{ fontSize: '0.8rem', color: '#F8FAFC' }}>{valor}</strong>
    </div>
  ) : null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(2,6,23,0.85)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto'
    }}>
      <div className="card-panel" style={{ maxWidth: '480px', width: '100%', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={20} color="#34D399" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white' }}>Leer etiqueta de packing</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '12px', lineHeight: 1.5 }}>
          Escanea el QR de la caja con la cámara de tu teléfono y pega aquí el contenido.
          Se completarán automáticamente los datos del proceso.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button type="button" className="btn-secondary" onClick={pegarDesdePortapapeles} style={{ flex: 1, justifyContent: 'center' }}>
            <ClipboardPaste size={16} color="#34D399" />
            <span>Pegar del portapapeles</span>
          </button>
        </div>

        <textarea
          className="form-textarea"
          rows={4}
          placeholder='Ejemplo: {"caja":{"ID":3198281,"Esp":"NA","Cal":"72","NProc":220,...}}'
          value={texto}
          onChange={e => analizar(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
        />

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginTop: '10px' }}>
            {error}
          </div>
        )}

        {preview && (
          <div style={{ background: '#0F172A', border: '1px solid #059669', borderRadius: '10px', padding: '12px 14px', marginTop: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.05em' }}>
              DATOS DETECTADOS EN LA ETIQUETA
            </div>
            {fila('N° Proceso', preview.processNumber)}
            {fila('Especie', preview.species)}
            {fila('Variedad', preview.variety)}
            {fila('Calibre', preview.caliber)}
            {fila('Lote', preview.lot)}
            {fila('Productor (CSG)', preview.csg)}
            {fila('SDP', preview.sdp)}
            {fila('Fecha proceso', preview.receptionDate)}
            {fila('N° de caja', preview.boxSerial)}
            {fila('Categoría etiqueta', preview.labelCategory)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!preview}
            onClick={() => { if (preview) { onApply(preview); onClose(); } }}
            style={{ flex: 2, opacity: preview ? 1 : 0.5 }}
          >
            <Check size={18} />
            <span>Usar estos datos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
