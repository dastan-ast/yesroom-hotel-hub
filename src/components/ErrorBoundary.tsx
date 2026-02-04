import * as React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught error:", error);
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-svh bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-lg border bg-card p-6 space-y-3">
          <h1 className="text-lg font-semibold">Произошла ошибка в интерфейсе</h1>
          <p className="text-sm text-muted-foreground">
            Откройте консоль браузера — там будет точный стек компонента. После фикса можно просто обновить страницу.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3 overflow-auto max-h-48">
              {this.state.error.message}
            </pre>
          )}
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
}
