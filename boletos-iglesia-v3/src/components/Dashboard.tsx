'use client';

import { useState } from 'react';
import type { Registro, Asiento, Nacion } from '@/types';

function getWeekRange(weekOffset: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(weekOffset: number) {
  const { start, end } = getWeekRange(weekOffset);
  const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

interface DayData {
  date: string;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  stripe: number;
  otro: number;
  total: number;
}

function buildChartData(pagos: any[], filterMode: 'all' | 'week', weekRange: { start: Date; end: Date }): DayData[] {
  const map: Record<string, DayData> = {};

  if (filterMode === 'week') {
    // Pre-fill all 7 days of the week
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekRange.start);
      d.setDate(weekRange.start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, efectivo: 0, tarjeta: 0, transferencia: 0, stripe: 0, otro: 0, total: 0 };
    }
  }

  for (const p of pagos) {
    if (!p.created_at) continue;
    const key = new Date(p.created_at).toISOString().slice(0, 10);
    if (!map[key]) map[key] = { date: key, efectivo: 0, tarjeta: 0, transferencia: 0, stripe: 0, otro: 0, total: 0 };
    const monto = Number(p.monto);
    const method = p.metodo_pago as 'efectivo' | 'tarjeta' | 'transferencia' | 'stripe' | 'otro';
    if (method in map[key]) (map[key] as any)[method] += monto;
    map[key].total += monto;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

const METHOD_COLORS: Record<string, string> = {
  efectivo: '#4ade80',
  tarjeta: '#60a5fa',
  transferencia: '#c084fc',
  stripe: '#818cf8',
  otro: '#94a3b8',
};

function PaymentChart({ data }: { data: DayData[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null);

  if (data.length === 0 || data.every(d => d.total === 0)) {
    return (
      <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Sin pagos en este período
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const chartH = 140;
  const barSlot = Math.min(52, Math.floor(700 / data.length));
  const barW = Math.max(8, barSlot - 6);
  const paddingL = 48;
  const paddingB = 28;
  const totalW = paddingL + data.length * barSlot + 8;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${totalW} ${chartH + paddingB + 4}`}
        style={{ minWidth: Math.min(totalW, 320) }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y grid lines & labels */}
        {yTicks.map(t => {
          const y = 4 + chartH * (1 - t);
          const val = maxTotal * t;
          return (
            <g key={t}>
              <line x1={paddingL} y1={y} x2={totalW - 4} y2={y} stroke="#374151" strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={paddingL - 4} y={y + 3} textAnchor="end" fontSize={7} fill="#6b7280">
                {val >= 1000 ? `$${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k` : `$${Math.round(val)}`}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingL + i * barSlot + (barSlot - barW) / 2;
          let stackY = 4 + chartH;
          const segments: { key: string; value: number }[] = [
            { key: 'efectivo', value: d.efectivo },
            { key: 'tarjeta', value: d.tarjeta },
            { key: 'transferencia', value: d.transferencia },
            { key: 'stripe', value: d.stripe },
            { key: 'otro', value: d.otro },
          ];

          const barRects = segments
            .filter(s => s.value > 0)
            .map(s => {
              const segH = Math.max(1, (s.value / maxTotal) * chartH);
              stackY -= segH;
              const rect = { key: s.key, x, y: stackY, h: segH };
              return rect;
            });

          const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });

          return (
            <g key={d.date}
              onMouseEnter={e => {
                const svgRect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTooltip({ x: x + barW / 2, y: 4 + chartH - (d.total / maxTotal) * chartH, day: d });
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Hover area */}
              <rect x={paddingL + i * barSlot} y={4} width={barSlot} height={chartH} fill="transparent" />
              {/* Segments */}
              {barRects.map(r => (
                <rect key={r.key} x={r.x} y={r.y} width={barW} height={r.h} fill={METHOD_COLORS[r.key]} rx={1} opacity={0.9} />
              ))}
              {/* X label */}
              <text x={x + barW / 2} y={4 + chartH + paddingB - 12} textAnchor="middle" fontSize={6.5} fill="#6b7280">
                {dayLabel}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line x1={paddingL} y1={4 + chartH} x2={totalW - 4} y2={4 + chartH} stroke="#374151" strokeWidth={1} />
        <line x1={paddingL} y1={4} x2={paddingL} y2={4 + chartH} stroke="#374151" strokeWidth={1} />

        {/* Tooltip */}
        {tooltip && (() => {
          const d = tooltip.day;
          const ttW = 110;
          const ttX = Math.min(tooltip.x - ttW / 2, totalW - ttW - 4);
          const ttY = Math.max(4, tooltip.y - 80);
          const methods = [
            { key: 'efectivo', label: 'Efectivo', value: d.efectivo },
            { key: 'tarjeta', label: 'Tarjeta', value: d.tarjeta },
            { key: 'transferencia', label: 'Transf.', value: d.transferencia },
            { key: 'stripe', label: 'Stripe', value: d.stripe },
            { key: 'otro', label: 'Otro', value: d.otro },
          ].filter(m => m.value > 0);
          return (
            <g>
              <rect x={ttX} y={ttY} width={ttW} height={16 + methods.length * 13 + 14} rx={4} fill="#1f2937" stroke="#374151" strokeWidth={0.5} />
              <text x={ttX + 6} y={ttY + 11} fontSize={7.5} fill="#e5e7eb" fontWeight="600">
                {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
              </text>
              {methods.map((m, mi) => (
                <g key={m.key}>
                  <rect x={ttX + 6} y={ttY + 18 + mi * 13} width={5} height={5} fill={METHOD_COLORS[m.key]} rx={1} />
                  <text x={ttX + 15} y={ttY + 24 + mi * 13} fontSize={7} fill="#d1d5db">{m.label}: ${m.value.toLocaleString()}</text>
                </g>
              ))}
              <text x={ttX + 6} y={ttY + 22 + methods.length * 13} fontSize={7.5} fill="#e5e7eb" fontWeight="600">
                Total: ${d.total.toLocaleString()}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {[
          { key: 'efectivo', label: 'Efectivo' },
          { key: 'tarjeta', label: 'Tarjeta' },
          { key: 'transferencia', label: 'Transferencia' },
          { key: 'stripe', label: 'Stripe' },
          { key: 'otro', label: 'Otro' },
        ].map(m => (
          <div key={m.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: METHOD_COLORS[m.key] }} />
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  registros: Registro[];
  asientos: Asiento[];
  naciones: Nacion[];
  eventoFecha?: string;
  eventoNombre?: string;
  isFreeEvent?: boolean;
  equipos?: any[];
  isEncuentro?: boolean;
}

export default function Dashboard({ registros: allRegistros, asientos, naciones, eventoFecha, eventoNombre, isFreeEvent = false, equipos = [], isEncuentro = false }: Props) {
  const [filterMode, setFilterMode] = useState<'all' | 'week'>('all');
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedEquipo, setExpandedEquipo] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [noVinieroExpanded, setNoVinieroExpanded] = useState(false);

  // Exclude conferencistas from all dashboard stats
  const registros = allRegistros.filter(r => (r as any).tipo !== 'conferencista');

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

  // Paid event dashboard
  const boletosLiquidados = registros.filter(r => r.status === 'liquidado').length;
  const boletosAbono = registros.filter(r => r.status === 'abono').length;
  const boletosPendientes = registros.filter(r => r.status === 'pendiente').length;

  const hasAsientos = asientos.length > 0;
  const regularAsientos = asientos.filter(a => a.fila !== 'RE');
  const totalAsientosOcupados = regularAsientos.filter(a => a.estado === 'ocupado').length;
  const totalAsientos = regularAsientos.filter(a => a.estado !== 'no_disponible').length;
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

  const hasEquipos = equipos.length > 0;
  const equipoRanking = equipos
    .map(eq => {
      const regs = registros.filter(r => r.equipo_id === eq.id);
      return {
        ...eq,
        count: regs.length,
        liquidados: regs.filter(r => r.status === 'liquidado').length,
        abonos: regs.filter(r => r.status === 'abono').length,
        pendientes: regs.filter(r => r.status === 'pendiente').length,
        recaudado: regs.reduce((s, r) => s + Number(r.monto_pagado), 0),
        porCobrar: regs.reduce((s, r) => s + (Number(r.monto_total) - Number(r.monto_pagado)), 0),
        miembros: regs,
      };
    })
    .filter(eq => eq.count > 0)
    .sort((a, b) => b.recaudado - a.recaudado);

  const maxEquipoCount = equipoRanking.length > 0 ? Math.max(...equipoRanking.map(e => e.count)) : 1;

  // Payment breakdown with filter
  const allPagos = registros.flatMap(r => (r.pagos || []) as any[]);
  const weekRange = getWeekRange(weekOffset);
  const filteredPagos = filterMode === 'week'
    ? allPagos.filter(p => {
        if (!p.created_at) return false;
        const d = new Date(p.created_at);
        return d >= weekRange.start && d <= weekRange.end;
      })
    : allPagos;

  const totalEfectivo = filteredPagos.filter(p => p.metodo_pago === 'efectivo').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const totalTarjeta = filteredPagos.filter(p => p.metodo_pago === 'tarjeta').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const totalTransferencia = filteredPagos.filter(p => p.metodo_pago === 'transferencia').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const totalOtro = filteredPagos.filter(p => p.metodo_pago === 'otro').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const stripePagos = filteredPagos.filter(p => p.metodo_pago === 'stripe');
  const totalStripe = stripePagos.reduce((s: number, p: any) => s + Number(p.monto), 0);

  const comisionStripe = totalStripe * (0.036 * 1.16);
  const netoStripe = totalStripe - comisionStripe;

  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay()); inicioSemana.setHours(0, 0, 0, 0);
  const stripeEstaSemana = allPagos.filter((p: any) => p.metodo_pago === 'stripe' && p.created_at && new Date(p.created_at) >= inicioSemana).reduce((s: number, p: any) => s + Number(p.monto), 0);

  const comisionPorcentaje = 0.035 * 1.16;
  const comisionTarjeta = totalTarjeta * comisionPorcentaje;
  const netoTarjeta = totalTarjeta - comisionTarjeta;
  const netoTotal = totalEfectivo + netoTarjeta + netoStripe + totalTransferencia + totalOtro;

  const chartData = buildChartData(filteredPagos, filterMode, weekRange);

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
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Check-in ({totalRegistrados > 0 ? Math.round(checkedIn / totalRegistrados * 100) : 0}%)</div>
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

      {/* Encuentro: Asistencia Día 1 */}
      {isEncuentro && (() => {
        const encuentristas = registros.filter(r => r.tipo === 'Encuentrista');
        const servidores = registros.filter(r => r.tipo === 'Servidor');
        const encuentristasCheckin = encuentristas.filter(r => r.checked_in).length;
        const servidoresCheckin = servidores.filter(r => r.checked_in).length;
        const noVinieron = registros.filter(r =>
          (r.status === 'abono' || r.status === 'liquidado') && !r.checked_in
        );
        return (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="px-6 pt-5 pb-4">
              <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Asistencia Día 1</h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Encuentristas */}
                <div className="rounded-xl p-4 border text-center" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                  <div className="text-3xl font-bold text-sky-400" style={{ fontFamily: 'var(--font-display)' }}>
                    {encuentristasCheckin}
                    <span className="text-base font-normal text-slate-500 ml-1">/ {encuentristas.length}</span>
                  </div>
                  <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>Encuentristas</div>
                  <div className="text-[10px] mt-0.5 text-sky-400/70">con check-in</div>
                </div>
                {/* Servidores */}
                <div className="rounded-xl p-4 border text-center" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                  <div className="text-3xl font-bold text-violet-400" style={{ fontFamily: 'var(--font-display)' }}>
                    {servidoresCheckin}
                    <span className="text-base font-normal text-slate-500 ml-1">/ {servidores.length}</span>
                  </div>
                  <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>Servidores</div>
                  <div className="text-[10px] mt-0.5 text-violet-400/70">con check-in</div>
                </div>
                {/* No vinieron */}
                <div className="rounded-xl p-4 border text-center" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                  <div className="text-3xl font-bold text-amber-400" style={{ fontFamily: 'var(--font-display)' }}>
                    {noVinieron.length}
                  </div>
                  <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>No se presentaron</div>
                  <div className="text-[10px] mt-0.5 text-amber-400/70">abono o liquidado sin check-in</div>
                </div>
              </div>
            </div>

            {/* Collapsible: quiénes no vinieron */}
            {noVinieron.length > 0 && (
              <div>
                <button
                  className="w-full flex items-center justify-between px-6 py-3 text-xs font-medium transition-colors hover:bg-white/5 border-t"
                  style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
                  onClick={() => setNoVinieroExpanded(v => !v)}
                >
                  <span className="text-amber-400/80">
                    Ver quiénes no se presentaron ({noVinieron.length})
                  </span>
                  <span className="text-slate-500">{noVinieroExpanded ? '▲ ocultar' : '▼ mostrar'}</span>
                </button>
                {noVinieroExpanded && (
                  <div className="border-t divide-y divide-white/5" style={{ borderColor: 'var(--color-border)' }}>
                    {noVinieron.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-6 py-2.5" style={{ background: 'var(--color-bg)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-medium text-sm truncate">{r.nombre}</span>
                          {r.tipo && r.tipo !== 'general' && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${r.tipo === 'Servidor' ? 'bg-violet-500/20 text-violet-400' : 'bg-sky-500/20 text-sky-400'}`}>
                              {r.tipo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${r.status === 'liquidado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {r.status === 'liquidado' ? 'Liquidado' : 'Abono'}
                          </span>
                          <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                            ${Number(r.monto_pagado).toLocaleString()}
                            {r.status !== 'liquidado' && (
                              <span className="text-slate-500 font-normal"> / ${Number(r.monto_total).toLocaleString()}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

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
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {/* Header + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Desglose por Método de Pago</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setFilterMode('all'); setWeekOffset(0); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterMode === 'all' ? 'var(--color-accent)' : 'var(--color-bg)',
                color: filterMode === 'all' ? '#000' : 'var(--color-text-muted)',
                border: '1px solid',
                borderColor: filterMode === 'all' ? 'var(--color-accent)' : 'var(--color-border)',
              }}
            >
              Todo el tiempo
            </button>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <button
                onClick={() => { setFilterMode('week'); setWeekOffset(w => w - 1); }}
                className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors hover:text-white"
                style={{ color: 'var(--color-text-muted)' }}
                title="Semana anterior"
              >
                ‹
              </button>
              <button
                onClick={() => setFilterMode('week')}
                className="px-2 py-0.5 rounded text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  color: filterMode === 'week' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  minWidth: 120,
                  textAlign: 'center',
                }}
              >
                {filterMode === 'week' ? formatWeekLabel(weekOffset) : 'Por semana'}
              </button>
              <button
                onClick={() => { setFilterMode('week'); setWeekOffset(w => Math.min(0, w + 1)); }}
                className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors hover:text-white"
                style={{ color: weekOffset >= 0 ? '#374151' : 'var(--color-text-muted)' }}
                disabled={weekOffset >= 0}
                title="Semana siguiente"
              >
                ›
              </button>
            </div>
            {filterMode === 'week' && weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
              >
                Hoy
              </button>
            )}
          </div>
        </div>

        {/* Method cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
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
              <span className="text-lg">🔵</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Stripe</span>
            </div>
            <div className="text-2xl font-bold text-indigo-400">${totalStripe.toLocaleString()}</div>
            <div className="text-[10px] mt-1 text-red-400">- ${comisionStripe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} comisión (4.18%)</div>
            <div className="text-[10px] text-indigo-400/60">Neto: ${netoStripe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {filterMode === 'all' && <div className="text-[10px] mt-1 text-indigo-300">Esta semana: ${stripeEstaSemana.toLocaleString()}</div>}
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

        {/* Timeline chart — collapsible */}
        <div className="rounded-lg mb-5" style={{ background: 'var(--color-bg)' }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => setShowChart(v => !v)}
          >
            <span>
              📈 Ingresos por fecha
              {filterMode === 'week' && <span className="ml-1 opacity-60">— {formatWeekLabel(weekOffset)}</span>}
            </span>
            <span className="text-slate-500">{showChart ? '▲ ocultar' : '▼ ver gráfica'}</span>
          </button>
          {showChart && (
            <div className="px-4 pb-4">
              <PaymentChart data={chartData} />
            </div>
          )}
        </div>

        {/* Net summary */}
        <div className="rounded-lg p-4 flex items-center justify-between" style={{ background: 'rgba(0,188,212,0.05)', border: '1px solid rgba(0,188,212,0.2)' }}>
          <div>
            <div className="text-sm font-medium">Ingreso neto real (después de comisiones)</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Tarjeta (4.06%): -${comisionTarjeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Stripe (4.18%): -${comisionStripe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {filterMode === 'week' && <span className="ml-1 opacity-70">· {formatWeekLabel(weekOffset)}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>
              ${netoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              de ${(totalEfectivo + totalTarjeta + totalTransferencia + totalStripe + totalOtro).toLocaleString()} recaudado bruto
              {filterMode === 'week' ? ' en esta semana' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Equipo ranking (campamento style) or Nación ranking */}
      {hasEquipos ? (
        <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Ranking por Equipo</h3>
            {/* PDF export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                📄 Exportar PDF {exportDropdownOpen ? '▲' : '▼'}
              </button>
              {exportDropdownOpen && (
                <div
                  className="absolute right-0 mt-1 rounded-lg overflow-hidden z-20 shadow-xl"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', minWidth: 200 }}
                >
                  {/* All teams option */}
                  {[{ id: '__all__', nombre: 'Todos los equipos', color: 'var(--color-accent)', lider: null, consejero: null }].concat(equipoRanking).map(opt => (
                    <button
                      key={opt.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/10"
                      style={{ color: opt.id === '__all__' ? 'var(--color-accent)' : 'var(--color-text)' }}
                      onClick={async () => {
                        setExportDropdownOpen(false);
                        const isAll = opt.id === '__all__';
                        const targets = isAll ? equipoRanking : equipoRanking.filter(e => e.id === opt.id);
                        try {
                          const jsPDFModule = await import('jspdf');
                          const jsPDF = jsPDFModule.default;
                          await import('jspdf-autotable');
                          const doc = new jsPDF('portrait', 'mm', 'letter');
                          const pageW = doc.internal.pageSize.getWidth();
                          const now = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                          // ── Global header ──
                          doc.setFontSize(18);
                          doc.setFont('helvetica', 'bold');
                          doc.setTextColor(0, 188, 212);
                          doc.text('Cobranza por Equipo', 14, 18);
                          doc.setFontSize(10);
                          doc.setFont('helvetica', 'normal');
                          doc.setTextColor(100, 100, 100);
                          doc.text(`${eventoNombre || 'Evento'}  ·  ${isAll ? 'Todos los equipos' : opt.nombre}`, 14, 25);
                          doc.text(`Generado: ${now}`, 14, 31);

                          // Global totals line
                          const totalInscritos = targets.reduce((s, e) => s + e.count, 0);
                          const totalRec = targets.reduce((s, e) => s + e.recaudado, 0);
                          const totalPend = targets.reduce((s, e) => s + e.porCobrar, 0);
                          doc.setTextColor(30, 30, 30);
                          doc.setFont('helvetica', 'bold');
                          doc.setFontSize(9);
                          doc.text(`Total inscritos: ${totalInscritos}   Recaudado: $${totalRec.toLocaleString()}   Por cobrar: $${totalPend.toLocaleString()}`, 14, 37);
                          doc.setFont('helvetica', 'normal');

                          let currentY = 43;

                          targets.forEach((eq, idx) => {
                            // ── Team header block ──
                            if (currentY > 230) { doc.addPage(); currentY = 16; }

                            // Colored band for team name
                            doc.setFillColor(30, 40, 58);
                            doc.roundedRect(14, currentY, pageW - 28, 12, 2, 2, 'F');

                            // Dot (simulate color)
                            const hex = eq.color || '#00bcd4';
                            const r2 = parseInt(hex.slice(1, 3), 16) || 0;
                            const g2 = parseInt(hex.slice(3, 5), 16) || 188;
                            const b2 = parseInt(hex.slice(5, 7), 16) || 212;
                            doc.setFillColor(r2, g2, b2);
                            doc.circle(20, currentY + 6, 2.5, 'F');

                            doc.setFontSize(11);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(r2, g2, b2);
                            doc.text(eq.nombre, 25, currentY + 7.5);

                            // Leader text on the right
                            if (eq.lider || eq.consejero) {
                              doc.setFontSize(8);
                              doc.setFont('helvetica', 'normal');
                              doc.setTextColor(160, 160, 160);
                              const liderText = [eq.lider && `Líder: ${eq.lider}`, eq.consejero && `Consejero: ${eq.consejero}`].filter(Boolean).join('  ·  ');
                              doc.text(liderText, pageW - 14, currentY + 7.5, { align: 'right' });
                            }

                            // Stats row
                            doc.setFontSize(8);
                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(100, 100, 100);
                            const statsText = `${eq.count} inscritos  ·  ${eq.liquidados} liquidados  ·  ${eq.abonos} abonos  ·  ${eq.pendientes} pendientes  ·  Recaudado: $${eq.recaudado.toLocaleString()}  ·  Por cobrar: $${eq.porCobrar.toLocaleString()}`;
                            doc.text(statsText, 14, currentY + 17);

                            currentY += 20;

                            // ── Member table ──
                            const body = eq.miembros.map((r: any, mi: number) => {
                              const pagado = Number(r.monto_pagado);
                              const total = Number(r.monto_total);
                              const saldo = total - pagado;
                              const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
                              const statusLabel = r.status === 'liquidado' ? 'Liquidado' : r.status === 'abono' ? 'Abono' : 'Pendiente';
                              return [
                                (mi + 1).toString(),
                                r.nombre,
                                r.edad ? `${r.edad}a` : '—',
                                statusLabel,
                                `$${pagado.toLocaleString()}`,
                                saldo > 0 ? `$${saldo.toLocaleString()}` : '—',
                                `${pct}%`,
                              ];
                            });

                            (doc as any).autoTable({
                              startY: currentY,
                              head: [['#', 'Nombre', 'Edad', 'Estatus', 'Pagado', 'Saldo', '% Avance']],
                              body,
                              theme: 'grid',
                              headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                              bodyStyles: { fontSize: 8, cellPadding: 2.5 },
                              columnStyles: {
                                0: { cellWidth: 10, halign: 'center' },
                                1: { cellWidth: 65 },
                                2: { cellWidth: 14, halign: 'center' },
                                3: { cellWidth: 24, halign: 'center' },
                                4: { cellWidth: 22, halign: 'right' },
                                5: { cellWidth: 22, halign: 'right' },
                                6: { cellWidth: 18, halign: 'center' },
                              },
                              alternateRowStyles: { fillColor: [245, 247, 250] },
                              didParseCell: (data: any) => {
                                if (data.section === 'body' && data.column.index === 3) {
                                  const v = data.cell.raw;
                                  if (v === 'Liquidado') { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = 'bold'; }
                                  else if (v === 'Abono') { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = 'bold'; }
                                  else { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold'; }
                                }
                                if (data.section === 'body' && data.column.index === 6) {
                                  const pctVal = parseInt(data.cell.raw);
                                  if (pctVal === 100) data.cell.styles.textColor = [16, 185, 129];
                                  else if (pctVal >= 50) data.cell.styles.textColor = [245, 158, 11];
                                  else data.cell.styles.textColor = [239, 68, 68];
                                }
                              },
                              didDrawPage: (data: any) => {
                                const pageCount = (doc as any).internal.getNumberOfPages();
                                doc.setFontSize(8);
                                doc.setTextColor(150, 150, 150);
                                doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
                              },
                            });

                            currentY = (doc as any).lastAutoTable.finalY + (idx < targets.length - 1 ? 10 : 0);
                          });

                          const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                          const nombreSlug = isAll ? 'Todos-los-equipos' : opt.nombre.replace(/\s+/g, '-');
                          doc.save(`Reporte-Registro-${nombreSlug}-${fecha}.pdf`);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      {opt.id !== '__all__' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: (opt as any).color || 'var(--color-accent)' }} />
                      )}
                      {opt.id === '__all__' && <span>📋</span>}
                      <span className="truncate">{opt.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {equipoRanking.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin registros aún</p> : (
            <div className="space-y-3">
              {equipoRanking.map((eq, i) => (
                <div key={eq.id}>
                  {/* Row */}
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedEquipo(expandedEquipo === eq.id ? null : eq.id)}
                  >
                    <div className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-white/5">
                      <div className="w-7 text-center flex-shrink-0">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>}
                      </div>
                      <div className="flex flex-col justify-center w-48 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: eq.color || 'var(--color-accent)' }} />
                          <span className="text-sm font-semibold truncate">{eq.nombre}</span>
                        </div>
                        {(eq.lider || eq.consejero) && (
                          <div className="text-[10px] mt-0.5 ml-5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {eq.lider && `Líder: ${eq.lider}`}{eq.lider && eq.consejero && ' · '}{eq.consejero && `Consejero: ${eq.consejero}`}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 h-7 rounded-md overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                        <div className="h-full rounded-md flex items-center px-2 transition-all duration-700"
                          style={{ width: `${Math.max(8, (eq.count / maxEquipoCount) * 100)}%`, background: `${eq.color || 'var(--color-accent)'}40`, borderLeft: `3px solid ${eq.color || 'var(--color-accent)'}` }}>
                          <span className="text-xs font-bold whitespace-nowrap">{eq.count}</span>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-shrink-0 text-xs items-center">
                        <div className="text-center">
                          <div className="font-bold text-emerald-400">{eq.liquidados}</div>
                          <div style={{ color: 'var(--color-text-muted)' }}>liquid.</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-amber-400">{eq.abonos}</div>
                          <div style={{ color: 'var(--color-text-muted)' }}>abono</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-red-400">{eq.pendientes}</div>
                          <div style={{ color: 'var(--color-text-muted)' }}>pend.</div>
                        </div>
                        <div className="text-center min-w-[72px]">
                          <div className="font-bold" style={{ color: 'var(--color-accent)' }}>${eq.recaudado.toLocaleString()}</div>
                          <div style={{ color: 'var(--color-text-muted)' }}>recaud.</div>
                        </div>
                        <span className="text-slate-500 text-base">{expandedEquipo === eq.id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded member list */}
                  {expandedEquipo === eq.id && (
                    <div className="mt-1 ml-10 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                      {/* Totals bar */}
                      <div className="px-3 py-2 flex items-center justify-between text-xs" style={{ background: `${eq.color || 'var(--color-accent)'}18` }}>
                        <span className="font-semibold" style={{ color: eq.color || 'var(--color-accent)' }}>
                          {eq.count} inscritos · ${eq.recaudado.toLocaleString()} recaudado
                        </span>
                        {eq.porCobrar > 0 && (
                          <span className="text-amber-400">${eq.porCobrar.toLocaleString()} por cobrar</span>
                        )}
                      </div>
                      {/* Member rows */}
                      <div className="divide-y divide-white/5">
                        {eq.miembros.map((r: any) => {
                          const pct = Number(r.monto_total) > 0 ? Math.round((Number(r.monto_pagado) / Number(r.monto_total)) * 100) : 0;
                          return (
                            <div key={r.id} className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--color-bg)' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium truncate">{r.nombre}</span>
                                {r.edad && <span className="text-xs text-slate-500">{r.edad}a</span>}
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${
                                  r.status === 'liquidado' ? 'bg-emerald-500/20 text-emerald-400' :
                                  r.status === 'abono' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {r.status === 'liquidado' ? 'Liquidado' : r.status === 'abono' ? 'Abono' : 'Pendiente'}
                                </span>
                                <span style={{ color: 'var(--color-accent)' }} className="font-bold">
                                  ${Number(r.monto_pagado).toLocaleString()}
                                  {r.status !== 'liquidado' && (
                                    <span className="text-slate-500 font-normal"> / ${Number(r.monto_total).toLocaleString()}</span>
                                  )}
                                </span>
                                {r.status !== 'liquidado' && (
                                  <span className="text-slate-500 w-8 text-right">{pct}%</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
      )}

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
