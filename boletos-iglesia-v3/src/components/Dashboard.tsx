'use client';

import type { Registro, Asiento, Nacion } from '@/types';

interface Props {
  registros: Registro[];
  asientos: Asiento[];
  naciones: Nacion[];
  eventoFecha?: string;
  eventoNombre?: string;
  isFreeEvent?: boolean;
  equipos?: any[];
}

export default function Dashboard({ registros, asientos, naciones, eventoFecha, eventoNombre, isFreeEvent = false, equipos = [] }: Props) {

  const totalRegistrados = registros.length;
  const checkedIn = registros.filter(r => r.checked_in).length;

  // Free event dashboard
  if (isFreeEvent) {
    const equipoStats = equipos.map(eq => {
      const count = registros.filter(r => r.equipo_id === eq.id).length;
      return { ...eq, count };
    }).sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...equipoStats.map(e => e.count), 1);

    const diasParaEvento = eventoFecha
      ? Math.ceil((new Date(eventoFecha + 'T12:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              📊 Dashboard — {eventoNombre || 'Evento'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Resumen de registros</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {diasParaEvento !== null && diasParaEvento > 0 && (
            <div className="rounded-xl p-6 border text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="text-4xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{diasParaEvento}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Días para el evento</div>
            </div>
          )}
          <div className="rounded-xl p-6 border text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-4xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{totalRegistrados}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Total Registrados</div>
          </div>
          <div className="rounded-xl p-6 border text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-4xl font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>{checkedIn}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Check-in</div>
          </div>
        </div>

        {/* Equipo breakdown */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>Registrados por Equipo</h3>
          <div className="space-y-4">
            {equipoStats.map(eq => (
              <div key={eq.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: eq.color }} />
                    <span className="text-sm font-medium">{eq.nombre}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{eq.count}</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(eq.count / maxCount) * 100}%`, background: eq.color, minWidth: eq.count > 0 ? '8px' : '0' }} />
                </div>
              </div>
            ))}
          </div>
          {equipoStats.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No hay equipos configurados</p>
          )}
        </div>

        {/* Recent registrations */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Últimos Registros</h3>
          <div className="space-y-2">
            {registros.slice(0, 10).map(r => {
              const equipo = equipos.find(e => e.id === r.equipo_id);
              return (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{r.nombre}</span>
                    {equipo && (
                      <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: equipo.color + '25', color: equipo.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: equipo.color }} />
                        {equipo.nombre.split(' ').slice(0, 3).join(' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Paid event dashboard (existing)
  const boletosLiquidados = registros.filter(r => r.status === 'liquidado').length;
  const boletosAbono = registros.filter(r => r.status === 'abono').length;
  const boletosPendientes = registros.filter(r => r.status === 'pendiente').length;

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

      {/* Desglose por método de pago */}
      {(() => {
        const allPagos = registros.flatMap(r => (r.pagos || []) as any[]);
        const totalEfectivo = allPagos.filter(p => p.metodo_pago === 'efectivo').reduce((s: number, p: any) => s + Number(p.monto), 0);
        const totalTarjeta = allPagos.filter(p => p.metodo_pago === 'tarjeta').reduce((s: number, p: any) => s + Number(p.monto), 0);
        const totalTransferencia = allPagos.filter(p => p.metodo_pago === 'transferencia').reduce((s: number, p: any) => s + Number(p.monto), 0);
        const totalOtro = allPagos.filter(p => p.metodo_pago === 'otro').reduce((s: number, p: any) => s + Number(p.monto), 0);

        // Mercado Pago: 3.5% + IVA (16%) = 3.5% * 1.16 = 4.06%
        const comisionPorcentaje = 0.035 * 1.16; // 4.06%
        const comisionTarjeta = totalTarjeta * comisionPorcentaje;
        const netoTarjeta = totalTarjeta - comisionTarjeta;
        const netoTotal = totalEfectivo + netoTarjeta + totalTransferencia + totalOtro;

        return (
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Desglose por Método de Pago</h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg p-4" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💵</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Efectivo</span>
                </div>
                <div className="text-2xl font-bold text-green-400">${totalEfectivo.toLocaleString()}</div>
                <div className="text-[10px] mt-1 text-green-400/60">Neto: ${totalEfectivo.toLocaleString()}</div>
              </div>

              <div className="rounded-lg p-4" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💳</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Tarjeta</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">${totalTarjeta.toLocaleString()}</div>
                <div className="text-[10px] mt-1 text-red-400">- ${comisionTarjeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} comisión MP</div>
                <div className="text-[10px] text-blue-400/60">Neto: ${netoTarjeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>

              <div className="rounded-lg p-4" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏦</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Transferencia</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">${totalTransferencia.toLocaleString()}</div>
                <div className="text-[10px] mt-1 text-purple-400/60">Neto: ${totalTransferencia.toLocaleString()}</div>
              </div>

              <div className="rounded-lg p-4" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📋</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Otro</span>
                </div>
                <div className="text-2xl font-bold text-slate-400">${totalOtro.toLocaleString()}</div>
                <div className="text-[10px] mt-1 text-slate-400/60">Neto: ${totalOtro.toLocaleString()}</div>
              </div>
            </div>

            {/* Resumen neto */}
            <div className="rounded-lg p-4 flex items-center justify-between" style={{ background: 'rgba(0,188,212,0.05)', border: '1px solid rgba(0,188,212,0.2)' }}>
              <div>
                <div className="text-sm font-medium">Ingreso neto real (después de comisiones)</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Comisión Mercado Pago: 3.5% + IVA (4.06%) sobre ${totalTarjeta.toLocaleString()} en tarjeta = -${comisionTarjeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>
                  ${netoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  de ${totalRecaudado.toLocaleString()} recaudado bruto
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
