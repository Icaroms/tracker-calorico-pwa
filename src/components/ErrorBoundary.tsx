import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const C = { ink: '#0F2A33', card: '#FFFFFF', slate: '#6B7E84', teal: '#0E7C7B', coral: '#E0613E' };

interface State { hasError: boolean; isChunkError: boolean; message?: string; }

/**
 * Pega qualquer erro de render (incluindo falha ao baixar um chunk lazy —
 * comum em PWA quando o service worker atualiza e a aba antiga tenta buscar
 * um arquivo que já não existe) e mostra algo acionável, nunca tela branca.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    const isChunkError = /dynamically imported module|loading chunk|importing a module script failed/i.test(msg);
    return { hasError: true, isChunkError, message: msg };
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary capturou:', error);
  }

  reload = () => {
    this.setState({ hasError: false, isChunkError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.ink }}>
        <AlertTriangle size={28} style={{ color: C.coral, margin: '0 auto 8px' }} />
        <p className="text-sm font-medium mb-1">
          {this.state.isChunkError ? 'O app foi atualizado — essa tela precisa recarregar.' : 'Algo deu errado nesta tela.'}
        </p>
        <p className="text-xs mb-4" style={{ color: C.slate }}>Seus dados estão salvos no aparelho e não foram afetados.</p>
        <button onClick={this.reload}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl text-white"
          style={{ background: C.teal }}>
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>
    );
  }
}
