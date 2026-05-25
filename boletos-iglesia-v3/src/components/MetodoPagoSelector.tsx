'use client';

import type { MetodoPago } from '@/types';

const METODO_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;
  idleBg: string;
  idleBorder: string;
  idleText: string;
  accent?: string;
}> = {
  efectivo: {
    label: 'Efectivo',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="14" width="40" height="26" rx="4" fill="#16a34a" opacity="0.9"/>
        <rect x="4" y="14" width="40" height="26" rx="4" stroke="#15803d" strokeWidth="1.5"/>
        <circle cx="24" cy="27" r="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
        <text x="24" y="31" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#16a34a">$</text>
        <rect x="6" y="16" width="6" height="6" rx="1.5" fill="#dcfce7" opacity="0.6"/>
        <rect x="36" y="28" width="6" height="6" rx="1.5" fill="#dcfce7" opacity="0.6"/>
      </svg>
    ),
    selectedBg: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
    selectedBorder: '#22c55e',
    selectedText: '#bbf7d0',
    idleBg: 'rgba(22,163,74,0.08)',
    idleBorder: 'rgba(22,163,74,0.3)',
    idleText: '#86efac',
    accent: '#22c55e',
  },
  tarjeta: {
    label: 'Tarjeta',
    icon: (
      <svg viewBox="0 0 56 36" fill="none" className="w-12 h-8" xmlns="http://www.w3.org/2000/svg">
        {/* MP logo mark */}
        <rect width="56" height="36" rx="5" fill="#009ee3"/>
        {/* Yellow accent bar */}
        <rect y="24" width="56" height="12" rx="0" fill="#ffdd00"/>
        <rect y="24" width="56" height="12" rx="0" fill="#ffdd00"/>
        {/* MP letters */}
        <text x="8" y="18" fontSize="13" fontWeight="800" fill="white" fontFamily="Arial, sans-serif">MP</text>
        {/* chip */}
        <rect x="8" y="4" width="10" height="8" rx="2" fill="#ffdd00" opacity="0.9"/>
        {/* card lines */}
        <rect x="6" y="27" width="16" height="2.5" rx="1" fill="#009ee3" opacity="0.7"/>
        <rect x="26" y="27" width="8" height="2.5" rx="1" fill="#009ee3" opacity="0.5"/>
        <rect x="38" y="27" width="12" height="2.5" rx="1" fill="#009ee3" opacity="0.5"/>
      </svg>
    ),
    selectedBg: 'linear-gradient(135deg, #003d73 0%, #005fa3 60%, #0077c8 100%)',
    selectedBorder: '#ffdd00',
    selectedText: '#fff',
    idleBg: 'rgba(0,158,227,0.08)',
    idleBorder: 'rgba(0,158,227,0.35)',
    idleText: '#7dd3fc',
    accent: '#009ee3',
  },
  transferencia: {
    label: 'Transferencia',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="8" width="40" height="32" rx="5" fill="#1d4ed8" opacity="0.85"/>
        <rect x="4" y="8" width="40" height="32" rx="5" stroke="#3b82f6" strokeWidth="1.5"/>
        {/* columns/pillars */}
        <rect x="10" y="22" width="5" height="12" rx="1" fill="#93c5fd"/>
        <rect x="18" y="18" width="5" height="16" rx="1" fill="#bfdbfe"/>
        <rect x="26" y="25" width="5" height="9" rx="1" fill="#93c5fd"/>
        <rect x="34" y="20" width="5" height="14" rx="1" fill="#bfdbfe"/>
        {/* roof line */}
        <path d="M8 22 L24 12 L40 22" stroke="#eff6ff" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
        <rect x="10" y="34" width="28" height="2" rx="1" fill="#93c5fd"/>
      </svg>
    ),
    selectedBg: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
    selectedBorder: '#60a5fa',
    selectedText: '#bfdbfe',
    idleBg: 'rgba(29,78,216,0.08)',
    idleBorder: 'rgba(59,130,246,0.3)',
    idleText: '#93c5fd',
    accent: '#3b82f6',
  },
  stripe: {
    label: 'Stripe',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#635bff"/>
        <path d="M22 18c0-1.5 1.2-2.5 3.5-2.5 2.8 0 5.5 1 7.5 2.5l2-4.5C33 12 30 11 26 11c-5.5 0-9 2.8-9 7.5 0 8.5 11.5 6.5 11.5 10 0 1.8-1.5 2.5-4 2.5-2.8 0-5.8-1-8-2.8L14 33c2.5 2 6 3.5 9.8 3.5 5.8 0 9.2-3 9.2-7.5C33 20.5 22 22.5 22 18z" fill="white"/>
      </svg>
    ),
    selectedBg: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)',
    selectedBorder: '#818cf8',
    selectedText: '#c7d2fe',
    idleBg: 'rgba(99,91,255,0.08)',
    idleBorder: 'rgba(99,91,255,0.3)',
    idleText: '#a5b4fc',
    accent: '#635bff',
  },
  otro: {
    label: 'Otro',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#374151" opacity="0.8"/>
        <circle cx="16" cy="24" r="3" fill="#9ca3af"/>
        <circle cx="24" cy="24" r="3" fill="#9ca3af"/>
        <circle cx="32" cy="24" r="3" fill="#9ca3af"/>
      </svg>
    ),
    selectedBg: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    selectedBorder: '#6b7280',
    selectedText: '#d1d5db',
    idleBg: 'rgba(55,65,81,0.15)',
    idleBorder: 'rgba(107,114,128,0.3)',
    idleText: '#9ca3af',
    accent: '#6b7280',
  },
};

interface MetodoPagoSelectorProps {
  value: MetodoPago;
  onChange: (m: MetodoPago) => void;
  /** 'full' = large visual cards (default), 'compact' = small inline chips */
  size?: 'full' | 'compact';
}

export function MetodoPagoSelector({ value, onChange, size = 'full' }: MetodoPagoSelectorProps) {
  const methods = Object.entries(METODO_CONFIG) as [MetodoPago, typeof METODO_CONFIG[string]][];

  if (size === 'compact') {
    return (
      <div className="flex flex-wrap gap-2">
        {methods.map(([key, cfg]) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className="px-3 py-1.5 rounded-lg text-xs border transition-all font-medium"
              style={{
                background: selected ? cfg.selectedBg : cfg.idleBg,
                borderColor: selected ? cfg.selectedBorder : cfg.idleBorder,
                color: selected ? cfg.selectedText : cfg.idleText,
                boxShadow: selected ? `0 0 0 1px ${cfg.selectedBorder}40` : 'none',
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {methods.map(([key, cfg]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-4 px-3 transition-all duration-150 cursor-pointer"
            style={{
              background: selected ? cfg.selectedBg : cfg.idleBg,
              borderColor: selected ? cfg.selectedBorder : cfg.idleBorder,
              color: selected ? cfg.selectedText : cfg.idleText,
              boxShadow: selected
                ? `0 0 0 1px ${cfg.selectedBorder}60, 0 4px 16px ${cfg.selectedBorder}30`
                : 'none',
              transform: selected ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {selected && (
              <span
                className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                style={{ background: cfg.selectedBorder, color: '#000' }}
              >
                ✓
              </span>
            )}
            <span className="flex items-center justify-center">{cfg.icon}</span>
            <span className="text-sm font-semibold leading-tight">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
