import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

/** Chặn lỗi hiển thị của một phân hệ để không làm trắng toàn bộ ứng dụng. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Module crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">Phân hệ gặp lỗi khi hiển thị</h2>
          <p className="text-xs text-slate-600">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
