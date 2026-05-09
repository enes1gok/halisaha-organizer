export type ToastVariant = 'success' | 'warning';

export type ShowToastOptions = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Default: ~3.8s success, ~5.5s warning */
  durationMs?: number;
  onDismiss?: () => void;
  /** Optional secondary control (e.g. copy); does not block auto-dismiss */
  actionLabel?: string;
  onActionPress?: () => void;
};
