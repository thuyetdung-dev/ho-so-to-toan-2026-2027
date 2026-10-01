import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** Bắt người dùng gõ đúng chuỗi này mới cho xác nhận (dùng cho thao tác không thể hoàn tác). */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(opts => {
    setTyped('');
    setOptions(opts);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const canConfirm = !options?.requireText || typed.trim() === options.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onKeyDown={e => {
            if (e.key === 'Escape') close(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {options.danger && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
                <h3 id="confirm-title" className="text-sm font-bold text-slate-900">
                  {options.title}
                </h3>
              </div>
              <button onClick={() => close(false)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">{options.message}</div>
            {options.requireText && (
              <label className="block text-xs text-slate-700">
                Gõ <strong className="font-mono text-rose-700">{options.requireText}</strong> để xác nhận:
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => close(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {options.cancelText || 'Hủy'}
              </button>
              <button
                autoFocus={!options.requireText}
                disabled={!canConfirm}
                onClick={() => close(true)}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40 ${
                  options.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {options.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};
