'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { METODOS_PAGO } from '@/lib/constants';
import type { Registro, Nacion, MetodoPago } from '@/types';

interface Props {
  registro: Registro;
  naciones: Nacion[];
  onBack: () => void;
  onRefresh: () => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function RegistroDetail({ registro, naciones, onBack, onRefresh, addToast }: Props) {
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [loading, setLoading] = useState(false);

  const saldo = Number(registro.monto_total) - Number(registro.monto_pagado);
  const nacion = naciones.find(n => n.id === registro.nacion_id);
  const pagos = (registro.pagos || []).sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleAbono = async () => {
    const monto = parseFloat(montoAbono);
    if (!monto || monto <= 0) { addToast('error', 'Ingresa un monto válido'); return; }
    if (monto > saldo) { addToast('error', 'El abono no puede ser mayor al saldo'); return; }

    setLoading(true);
    try {
      // 1. Record payment
      const { error: payError } = await supabase
        .from('pagos')
        .insert({
          registro_id: registro.id,
          monto,
          metodo_pago: metodoPago,
          referencia: referencia.trim() || null,
        });
      if (payError) throw payError;

      // 2. Update registro
      const newPagado = Number(registro.monto_pagado) + monto;
      const newStatus = newPagado >= Number(registro.monto_total) ? 'liquidado' : 'abono';

      const { error: regError } = await supabase
        .from('registros')
        .update({ monto_pagado: newPagado, status: newStatus })
        .eq('id', registro.id);
      if (regError) throw regError;

      // 3. Send email
      if (registro.correo) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registroId: registro.id }),
          });
        } catch { /* non-blocking */ }
      }

      addToast('success', `Abono de $${monto.toLocaleString()} registrado. ${newStatus === 'liquidado' ? '¡Boleto liquidado!' : ''}`);
      setMontoAbono('');
      setReferencia('');
      onRefresh();
      onBack();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!registro.correo) { addToast('error', 'No hay correo registrado'); return; }
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registroId: registro.id }),
      });
      if (res.ok) addToast('success', 'Comprobante enviado');
      else addToast('error', 'Error al enviar correo');
    } catch {
      addToast('error', 'Error al enviar correo');
    }
  };

  const statusColors: Record<string, string> = {
    pendiente: 'bg-red-500/20 text-red-400 border-red-500/30',
    abono: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    liquidado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const metodoPagoLabels: Record<string, string> = {
    efectivo: '💵 Efectivo',
    transferencia: '🏦 Transferencia',
    tarjeta: '💳 Tarjeta',
    otro: '📋 Otro',
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6 hover:underline" style={{ color: 'var(--color-accent)' }}>
        ← Volver a registros
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Info */}
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{registro.nombre}</h2>
                <div className="flex items-center gap-3 mt-2">
                  {nacion && (
                    <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                      style={{ background: nacion.color + '30', color: nacion.color, border: `1px solid ${nacion.color}50` }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: nacion.color }} />
                      {nacion.nombre}
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[registro.status]}`}>
                    {registro.status.charAt(0).toUpperCase() + registro.status.slice(1)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleResendEmail}
                className="px-3 py-2 rounded-lg text-xs border transition-all hover:border-cyan-500"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                title="Reenviar comprobante por correo"
              >
                📧 Enviar comprobante
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Teléfono:</span>
                <span className="ml-2">{registro.telefono || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Correo:</span>
                <span className="ml-2">{registro.correo || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Asientos:</span>
                <span className="ml-2 inline-flex gap-1">
                  {(registro.asientos || []).map((a: any) => (
                    <span key={a.id} className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>
                      {a.id}
                    </span>
                  ))}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Registrado:</span>
                <span className="ml-2">{new Date(registro.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Payment summary */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Resumen de Pago</h3>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                <div className="text-xl font-bold">${Number(registro.monto_total).toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total</div>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                <div className="text-xl font-bold text-emerald-400">${Number(registro.monto_pagado).toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pagado</div>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                <div className={`text-xl font-bold ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ${saldo.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Saldo</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (Number(registro.monto_pagado) / Number(registro.monto_total)) * 100)}%`,
                  background: registro.status === 'liquidado'
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                }}
              />
            </div>
            <div className="text-right text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {Math.round((Number(registro.monto_pagado) / Number(registro.monto_total)) * 100)}%
            </div>
          </div>

          {/* Payment history */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Historial de Pagos</h3>
            {pagos.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin pagos registrados</p>
            ) : (
              <div className="space-y-3">
                {pagos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="text-sm font-medium">{metodoPagoLabels[p.metodo_pago]}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {p.referencia && ` · Ref: ${p.referencia}`}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-emerald-400">+${Number(p.monto).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Add payment */}
        {saldo > 0 && (
          <div className="rounded-xl p-6 border h-fit sticky top-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Registrar Abono</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Saldo pendiente
                </label>
                <div className="text-2xl font-bold text-amber-400">${saldo.toLocaleString()}</div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Método de pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMetodoPago(m.value as MetodoPago)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all flex items-center gap-2 ${
                        metodoPago === m.value ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'
                      }`}
                      style={metodoPago === m.value ? { background: 'rgba(0, 188, 212, 0.15)' } : {}}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Monto del abono
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input
                    type="number"
                    value={montoAbono}
                    onChange={e => setMontoAbono(e.target.value)}
                    placeholder={saldo.toString()}
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm border bg-transparent"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
                <button
                  onClick={() => setMontoAbono(saldo.toString())}
                  className="text-xs underline mt-1"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Liquidar total
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  placeholder="# de transferencia, etc."
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>

              <button
                onClick={handleAbono}
                disabled={loading || !montoAbono}
                className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40 glow-pulse"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent), #0097a7)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {loading ? 'Procesando...' : `Registrar Abono de $${(parseFloat(montoAbono) || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
