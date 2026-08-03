import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

/**
 * Captura errores de renderizado de React.
 * Sin esto, un error en cualquier componente desmonta el árbol completo y deja
 * la pantalla en blanco — perdiendo de vista la sesión de muestreo en curso.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error de renderizado capturado:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#0F172A',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{
          maxWidth: '420px',
          textAlign: 'center',
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '28px 24px'
        }}>
          <AlertOctagon size={40} color="#F87171" style={{ marginBottom: '12px' }} />

          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 8px' }}>
            Ocurrió un error inesperado
          </h2>

          <p style={{ fontSize: '0.87rem', color: '#CBD5E1', margin: '0 0 6px', lineHeight: 1.5 }}>
            Las cajas que ya guardaste <strong style={{ color: '#34D399' }}>están a salvo</strong> en
            este dispositivo. Al recargar podrás continuar el muestreo donde ibas.
          </p>

          <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0 0 20px', wordBreak: 'break-word' }}>
            Detalle técnico: {this.state.message || 'sin descripción'}
          </p>

          <button
            type="button"
            className="btn-primary"
            onClick={this.handleReload}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <RefreshCw size={18} />
            <span>Recargar la aplicación</span>
          </button>
        </div>
      </div>
    );
  }
}
