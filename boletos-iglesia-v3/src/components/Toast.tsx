'use client';

interface Props {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function Toast({ type, message }: Props) {
  const styles = {
    success: { bg: '#065f46', border: '#10b981', icon: '✓' },
    error: { bg: '#7f1d1d', border: '#ef4444', icon: '✕' },
    info: { bg: '#1e3a5f', border: '#00bcd4', icon: 'ℹ' },
  };

  const s = styles[type];

  return (
    <div
      className="toast-enter flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl max-w-sm"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="text-lg">{s.icon}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
