import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
  }

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white mb-1">
                Ocorreu um erro inesperado
              </h1>
              <p className="text-xs text-neutral-400">
                A aplicação encontrou um problema durante a renderização.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-left font-mono text-[11px] text-rose-300 break-words overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar Página</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Limpar Dados de Cache e Reiniciar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
