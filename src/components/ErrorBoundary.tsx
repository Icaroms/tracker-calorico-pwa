import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ThemeContext, type Palette } from '../theme';

const FALLBACK_C: Palette = { ink: '#0F2A33', bg: '#EEF3F4', card: '#FFFFFF', slate: '#6B7E84', line: '#DCE5E6', teal: '#0E7C7B', green: '#2BA84A', amber: '#E8A33D', coral: '#E0613E', good: '#2BA84A', warn: '#E8A33D', alert: '#E0613E', chipBg: '#F1F6F6', tintGreen: '#E4F1E8', tintAmber: '#FBF0DC', tintTeal: '#EEF2F2' };

interface State { hasError: boolean; isChunkError: boolean; message?: string; }

/**
 * Pega qualquer erro de render (incluindo falha ao baixar um chunk lazy —
 * comum em PWA quando o service worker atualiza e a aba antiga tenta buscar
 * um arquivo que já não existe) e mostra algo acionável, nunca tela branca.
 *
 * Class component não pode usar hooks (useTheme) — usa `static contextType`
 * pra ler o mesmo ThemeContext e respeitar o modo escuro mesmo aqui.
 * FALLBACK_C cobre o caso raro do provider não estar disponível.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  static contextType = ThemeContext;
  declare context: React.ContextType<typeof ThemeContext>;

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
    const C = this.context?.palette ?? FALLBACK_C;
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.ink, background: C.bg, minHeight: '100vh' }}>
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
