import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast as ToastType } from '@/types';
import { useAppStore } from '@/store/useAppStore';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-accent-green/20 border-accent-green/50 text-accent-green',
  error: 'bg-accent-red/20 border-accent-red/50 text-accent-red',
  warning: 'bg-accent-yellow/20 border-accent-yellow/50 text-accent-yellow',
  info: 'bg-primary-500/20 border-primary-500/50 text-primary-400',
};

interface ToastItemProps {
  toast: ToastType;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const removeToast = useAppStore(state => state.removeToast);
  const Icon = iconMap[toast.type];

  const handleAction = () => {
    toast.action?.onClick();
    removeToast(toast.id);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md
        shadow-lg animate-fade-in ${colorMap[toast.type]}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium text-dark-100">{toast.message}</span>
      {toast.action && (
        <button
          onClick={handleAction}
          className="ml-1 px-2 py-0.5 text-xs font-semibold rounded border border-current hover:bg-white/10 transition-colors flex-shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => removeToast(toast.id)}
        className={`${toast.action ? '' : 'ml-auto'} p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0`}
      >
        <X className="w-4 h-4 text-dark-400" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useAppStore(state => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
