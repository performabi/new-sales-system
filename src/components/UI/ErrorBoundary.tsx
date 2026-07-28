import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '24px', textAlign: 'center',
          background: 'var(--bg-body)', color: 'var(--text-primary)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '480px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button className="btn btn-primary" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
