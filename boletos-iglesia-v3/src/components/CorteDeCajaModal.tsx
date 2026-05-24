'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface EventoCorte {
  id: string;
  nombre: string;
  total: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  stripe: number;
  otro: number;
}

const REFRESH_INTERVAL = 30_000; // 30 segundos

export default function CorteDeCajaModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventos, setEventos] = useState<EventoCorte[]>([]);
  const [fecha, setFecha] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const r = await fetch(`/api/corte-de-caja?t=${Date.now()}`, { cache: 'no-store' });
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        setEventos(data.eventos || []);
        setFecha(data.fecha || '');
        setError('');
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    timerRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  const fechaFormateada = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  function generateWhatsAppText(): string {
    const lines: string[] = [];
    lines.push(`Corte de Caja — Hoy ${fechaFormateada}`);

    eventos.forEach((ev, i) => {
      lines.push('');
      if (i > 0) {
        lines.push('—————————————');
        lines.push('');
      }

      lines.push(ev.nombre);
      lines.push(`$${ev.total.toLocaleString('es-MX')} - Total`);
      lines.push('');

      if (ev.efectivo > 0) lines.push(`💵 $${ev.efectivo.toLocaleString('es-MX')} - Efectivo`);
      if (ev.tarjeta > 0) lines.push(`💳 $${ev.tarjeta.toLocaleString('es-MX')} - Tarjeta`);
      if (ev.transferencia > 0) lines.push(`🏦 $${ev.transferencia.toLocaleString('es-MX')} - Transferencia`);
      if (ev.stripe > 0) lines.push(`⚡ $${ev.stripe.toLocaleString('es-MX')} - En línea`);
      if (ev.otro > 0) lines.push(`📋 $${ev.otro.toLocaleString('es-MX')} - Otro`);
    });

    return lines.join('\n');
  }

  const whatsappText = !loading && eventos.length > 0 ? generateWhatsAppText() : '';

  const grandTotal = eventos.reduce((s, e) => s + e.total, 0);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-accent)', boxShadow: '0 0 40px rgba(0,188,212,0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              📊 Corte de Caja
            </h2>
            {fechaFormateada && (
              <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--color-text-muted)' }}>{fechaFormateada}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Actualizar"
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity opacity-60 hover:opacity-100 disabled:opacity-30"
              style={{ color: 'var(--color-accent)' }}
            >
              {refreshing ? '⏳' : '🔄'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-xl transition-opacity opacity-50 hover:opacity-100"
              style={{ color: 'var(--color-text)' }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Cargando...</div>
          )}

          {!loading && error && (
            <div className="text-red-400 text-sm text-center py-6">{error}</div>
          )}

          {!loading && !error && eventos.length === 0 && (
            <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              No hay pagos registrados hoy
            </div>
          )}

          {!loading && !error && eventos.length > 0 && (
            <>
              {/* Per-event summary cards */}
              <div className="space-y-3 mb-4">
                {eventos.map(ev => (
                  <div key={ev.id} className="rounded-xl p-4 border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{ev.nombre}</span>
                      <span className="font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        ${ev.total.toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {ev.efectivo > 0 && <span>💵 ${ev.efectivo.toLocaleString('es-MX')}</span>}
                      {ev.tarjeta > 0 && <span>💳 ${ev.tarjeta.toLocaleString('es-MX')}</span>}
                      {ev.transferencia > 0 && <span>🏦 ${ev.transferencia.toLocaleString('es-MX')}</span>}
                      {ev.stripe > 0 && <span>⚡ ${ev.stripe.toLocaleString('es-MX')}</span>}
                      {ev.otro > 0 && <span>📋 ${ev.otro.toLocaleString('es-MX')}</span>}
                    </div>
                  </div>
                ))}

                {/* Grand total */}
                <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-accent)', background: 'rgba(0,188,212,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Total general del día</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>
                      ${grandTotal.toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Last updated */}
              {lastUpdatedStr && (
                <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Actualizado a las {lastUpdatedStr} · se actualiza cada 30 s
                </p>
              )}

              {/* Preview text */}
              <div
                className="rounded-xl p-4 text-xs font-mono whitespace-pre-wrap mb-4 max-h-52 overflow-y-auto"
                style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                {whatsappText}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: copied ? 'var(--color-accent)' : 'rgba(0,188,212,0.15)',
                    border: '1px solid var(--color-accent)',
                    color: copied ? 'white' : 'var(--color-accent)',
                  }}
                >
                  {copied ? '✓ ¡Copiado!' : '📋 Copiar'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center"
                  style={{
                    background: '#25D366',
                    color: 'white',
                  }}
                >
                  📲 Enviar por WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
