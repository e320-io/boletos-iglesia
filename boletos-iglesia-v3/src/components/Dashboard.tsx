'use client';

import { useState } from 'react';
import type { Registro, Asiento, Nacion } from '@/types';

interface Props {
  registros: Registro[];
  asientos: Asiento[];
  naciones: Nacion[];
  eventoFecha?: string;
  eventoNombre?: string;
}

export default function Dashboard({ registros, asientos, naciones, eventoFecha, eventoNombre }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const DASHBOARD_PIN = '1234';

  const handlePinSubmit = () => {
    if (pin === DASHBOARD_PIN) { setAuthenticated(true); setPinError(false); }
    else { setPinError(true); setPin(''); }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-xl p-8 border text-center w-full max-w-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: 'rgba(0,188,212,0.1)' }}>🔒</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Dashboard Ejecutivo</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Ingresa el PIN para acceder</p>
          <div className="space-y-3">
            <input type="password" value={pin} onChange={e => { setPin(e.target.value); setPinError(false); }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} placeholder="PIN" maxLength={10}
              className="w-full px-4 py-3 rounded-lg text-center text-2xl tracking-[0.5em] border bg-transparent"
              style={{ borderColor: pinError ? 'var(--color-danger)' : 'var(--color-border)', color: 'var(--color-text)' }} autoFocus />
            {pinError && <p className="text-xs text-red-400">PIN incorrecto</p>}
            <button onClick={handlePinSubmit} className="w-full py-3 rounded-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>Acceder</button>
          </div>
        </div>
      </div>
    );
  }

  const totalRegistrados = registros.length;
  const boletosLiquidados = registros.filter(r => r.status === 'liquidado').length;
  const boletosAbono = registros.filter(r => r.status === 'abono').length;
  const boletosPendientes = registros.filter(r => r.status === 'pendiente').length;
  const checkedIn = registros.filter(r => (r as any).checked_in).length;

  const hasAsientos = asientos.length > 0;
  const totalAsientosOcupados = asientos.filter(a => a.estado === 'ocupado').length;
  const totalAsientosDisponibles = asientos.filter(a => a.estado === 'disponible').length;
  const totalAsientos = asientos.filter(a => a.estado !== 'no_disponible').length;
  const porcentajeOcupacion = totalAsientos > 0 ? Math.round((totalAsientosOcupados / totalAsientos) * 100) : 0;

  const totalRecaudado = registros.reduce((s, r) => s + Number(r.monto_pagado), 0);
  const totalPorCobrar = registros.reduce((s, r) => s + (Number(r.monto_total) - Number(r.monto_pagado)), 0);
  const totalVenta = registros.reduce((s, r) => s + Number(r.monto_total), 0);

  const eventDate = eventoFecha ? new Date(eventoFecha + 'T12:00:00') : null;
  const diasParaEvento = eventDate ? Math.max(0, Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  const nacionRanking = naciones
    .map(n => {
      const regs = registros.filter(r => r.nacion_id === n.id);
      return { ...n, count: regs.length, liquidados: regs.filter(r => r.status === 'liquidado').length, recaudado: regs.reduce((s, r) => s + Number(r.monto_pagado), 0) };
    })
    .filter(n => n.count > 0)
    .sort((a, b) => b.count - a.count);

  const maxNacionCount = nacionRanking.length > 0 ? nacionRanking[0].count : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Dashboard — {eventoNombre || 'Evento'}</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Resumen ejecutivo</p>
        </div>
        <button onClick={() => setAuthenticated(false)} className="px-3 py-1.5 rounded-lg text-xs border hover:border-red-500 hover:text-red-400"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>🔒 Cerrar</button>
      </div>

      <div className={`grid grid-cols-2 ${hasAsientos ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4`}>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{diasParaEvento}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Días para el evento</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{totalRegistrados}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Registrados</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl font-bold text-purple-400" style={{ fontFamily: 'var(--font-display)' }}>{checkedIn}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Check-in ({totalRegistrados > 0 ? Math.round(checkedIn/totalRegistrados*100) : 0}%)</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>{boletosLiquidados}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Liquidados</div>
          <div className="flex gap-2 mt-1"><span className="text-[10px] text-amber-400">{boletosAbono} abonos</span><span className="text-[10px] text-red-400">{boletosPendientes} pendientes</span></div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>${totalRecaudado.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Recaudado</div>
        </div>
        {hasAsientos && (
          <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-4xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{porcentajeOcupacion}%</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Ocupación venue</div>
          </div>
        )}
      </div>

      {/* Cobranza progress */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Progreso de Cobranza</h3>
          <span className="text-sm font-bold text-emerald-400">{totalVenta > 0 ? Math.round((totalRecaudado / totalVenta) * 100) : 0}%</span>
        </div>
        <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${totalVenta > 0 ? (totalRecaudado / totalVenta) * 100 : 0}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>${totalRecaudado.toLocaleString()} cobrado</span>
          <span>${totalPorCobrar.toLocaleString()} pendiente</span>
        </div>
      </div>

      {/* Nación ranking */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Ranking por Nación</h3>
        {nacionRanking.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin registros aún</p> : (
          <div className="space-y-3">
            {nacionRanking.map((n, i) => (
              <div key={n.id} className="flex items-center gap-4">
                <div className="w-8 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>}
                </div>
                <div className="flex items-center gap-2 w-64 flex-shrink-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: n.color }} />
                  <span className="text-sm font-medium truncate">{n.nombre}</span>
                </div>
                <div className="flex-1 h-8 rounded-lg overflow-hidden relative" style={{ background: 'var(--color-bg)' }}>
                  <div className="h-full rounded-lg transition-all duration-700 flex items-center px-3"
                    style={{ width: `${Math.max(10, (n.count / maxNacionCount) * 100)}%`, background: `${n.color}40`, borderLeft: `3px solid ${n.color}` }}>
                    <span className="text-xs font-bold whitespace-nowrap">{n.count} inscritos</span>
                  </div>
                </div>
                <div className="flex gap-4 flex-shrink-0 text-xs">
                  <div className="text-center"><div className="font-bold text-emerald-400">{n.liquidados}</div><div style={{ color: 'var(--color-text-muted)' }}>liquid.</div></div>
                  <div className="text-center"><div className="font-bold" style={{ color: 'var(--color-accent)' }}>${n.recaudado.toLocaleString()}</div><div style={{ color: 'var(--color-text-muted)' }}>recaud.</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', count: boletosPendientes, sub: 'Sin pago', color: 'rgba(239,68,68', textColor: 'text-red-400' },
          { label: 'Con abono', count: boletosAbono, sub: 'Pago parcial', color: 'rgba(245,158,11', textColor: 'text-amber-400' },
          { label: 'Liquidados', count: boletosLiquidados, sub: 'Pago completo', color: 'rgba(16,185,129', textColor: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-5 border text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: `${s.color},0.1)`, border: `3px solid ${s.color},0.3)` }}>
              <span className={`text-2xl font-bold ${s.textColor}`} style={{ fontFamily: 'var(--font-display)' }}>{s.count}</span>
            </div>
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
