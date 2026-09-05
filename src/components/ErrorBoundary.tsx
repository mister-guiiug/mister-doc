import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { recordError } from '@mister-guiiug/dev-pwa-config/react/observability';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';

const log = createLogger('components');

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Capture les erreurs de rendu React et affiche un repli au lieu d'un écran blanc. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Journal d'erreurs partagé famille (localStorage, consultable au support).
    recordError(error, { source: 'error-boundary' });
    log.error('Erreur applicative :', {
      error: error,
      details: [info.componentStack],
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center p-4 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="text-lg font-bold">Une erreur est survenue</h1>
            <p className="mt-1 text-sm text-slate-500">
              {this.state.error.message}
            </p>
            <button
              onClick={() => location.reload()}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <RefreshCw className="size-4" /> Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
