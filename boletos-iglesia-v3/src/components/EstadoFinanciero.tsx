'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Registro, GastoEvento } from '@/types';

const COMISION_TARJETA = 0.035 * 1.16;
const COMISION_STRIPE = 0.036 * 1.16;

const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
] as const;

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  registros: Registro[];
  eventoId: string;
  eventoNombre: string;
}

export default function EstadoFinanciero({ registros, eventoId, eventoNombre }: Props) {
  const [gastos, setGastos] = useState<GastoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'otro'>('efectivo');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchGastos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gastos?evento_id=${eventoId}`);
      const data = await res.json();
      if (data.gastos) setGastos(data.gastos);
    } catch {
      setError('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  // Compute ingresos from registros pagos
  const allPagos = registros.flatMap(r => r.pagos ?? []);

  const totalEfectivo = allPagos.filter(p => p.metodo_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0);
  const totalTransferencia = allPagos.filter(p => p.metodo_pago === 'transferencia').reduce((s, p) => s + Number(p.monto), 0);
  const totalTarjetaBruto = allPagos.filter(p => p.metodo_pago === 'tarjeta').reduce((s, p) => s + Number(p.monto), 0);
  const totalStripeBruto = allPagos.filter(p => (p.metodo_pago as string) === 'stripe').reduce((s, p) => s + Number(p.monto), 0);
  const totalOtro = allPagos.filter(p => p.metodo_pago === 'otro').reduce((s, p) => s + Number(p.monto), 0);

  const comisionTarjeta = totalTarjetaBruto * COMISION_TARJETA;
  const netoTarjeta = totalTarjetaBruto - comisionTarjeta;
  const comisionStripe = totalStripeBruto * COMISION_STRIPE;
  const netoStripe = totalStripeBruto - comisionStripe;

  const totalIngresos = totalEfectivo + netoTarjeta + netoStripe + totalTransferencia + totalOtro;

  // Gastos totals
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const gastosPorMetodo = {
    efectivo: gastos.filter(g => g.metodo_pago === 'efectivo').reduce((s, g) => s + Number(g.monto), 0),
    transferencia: gastos.filter(g => g.metodo_pago === 'transferencia').reduce((s, g) => s + Number(g.monto), 0),
    tarjeta: gastos.filter(g => g.metodo_pago === 'tarjeta').reduce((s, g) => s + Number(g.monto), 0),
    otro: gastos.filter(g => g.metodo_pago === 'otro').reduce((s, g) => s + Number(g.monto), 0),
  };

  const balance = totalIngresos - totalGastos;

  async function handleAddGasto(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!concepto.trim() || isNaN(montoNum) || montoNum <= 0) {
      setError('Concepto y monto válido son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: eventoId, concepto: concepto.trim(), monto: montoNum, metodo_pago: metodoPago, fecha: fecha || null, notas: notas.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGastos(prev => [data.gasto, ...prev]);
      setConcepto('');
      setMonto('');
      setFecha('');
      setNotas('');
      setMetodoPago('efectivo');
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const res = await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setGastos(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const metodoBadge: Record<string, string> = {
    efectivo: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
    transferencia: 'bg-blue-900/40 text-blue-300 border-blue-700',
    tarjeta: 'bg-purple-900/40 text-purple-300 border-purple-700',
    stripe: 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
    otro: 'bg-slate-700/40 text-slate-300 border-slate-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Estado Financiero — {eventoNombre}</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ingresos netos y gastos del evento</p>
      </div>

      {/* Balance KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-3xl font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>${fmt(totalIngresos)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total ingresos netos</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-3xl font-bold text-red-400" style={{ fontFamily: 'var(--font-display)' }}>${fmt(totalGastos)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total gastos</div>
        </div>
        <div className="rounded-xl p-5 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className={`text-3xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-display)' }}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Balance</div>
        </div>
      </div>

      {/* Ingresos por método */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Ingresos por método de pago</h3>
        <div className="space-y-3">
          {totalEfectivo > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.efectivo}`}>Efectivo</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">${fmt(totalEfectivo)}</span>
            </div>
          )}
          {totalTarjetaBruto > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.tarjeta}`}>Tarjeta</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto: ${fmt(totalTarjetaBruto)} − comisión: ${fmt(comisionTarjeta)}</span>
                </div>
              </div>
              <span className="font-mono font-bold text-purple-400">${fmt(netoTarjeta)}</span>
            </div>
          )}
          {totalStripeBruto > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.stripe}`}>Stripe</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto: ${fmt(totalStripeBruto)} − comisión: ${fmt(comisionStripe)}</span>
                </div>
              </div>
              <span className="font-mono font-bold text-indigo-400">${fmt(netoStripe)}</span>
            </div>
          )}
          {totalTransferencia > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.transferencia}`}>Transferencia</span>
              </div>
              <span className="font-mono font-bold text-blue-400">${fmt(totalTransferencia)}</span>
            </div>
          )}
          {totalOtro > 0 && (
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge.otro}`}>Otro</span>
              </div>
              <span className="font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>${fmt(totalOtro)}</span>
            </div>
          )}
          {allPagos.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin pagos registrados</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-sm">Total ingresos netos</span>
            <span className="font-mono font-bold text-emerald-400">${fmt(totalIngresos)}</span>
          </div>
        </div>
      </div>

      {/* Gastos */}
      <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Gastos del evento</h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {showForm ? 'Cancelar' : '+ Agregar gasto'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddGasto} className="mb-5 p-4 rounded-lg space-y-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Concepto *</label>
                <input
                  value={concepto}
                  onChange={e => setConcepto(e.target.value)}
                  placeholder="Ej: Renta del local, decoración..."
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Monto *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Método de pago *</label>
                <select
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value as typeof metodoPago)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha (opcional)</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas (opcional)</label>
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              {saving ? 'Guardando...' : 'Guardar gasto'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
        ) : gastos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin gastos registrados</p>
        ) : (
          <div className="space-y-2">
            {gastos.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${metodoBadge[g.metodo_pago]}`}>
                    {METODOS.find(m => m.value === g.metodo_pago)?.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{g.concepto}</p>
                    {(g.fecha || g.notas) && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {g.fecha && new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {g.fecha && g.notas && ' · '}
                        {g.notas}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-red-400">${fmt(Number(g.monto))}</span>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:text-red-400"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Subtotals por método */}
            <div className="mt-4 pt-4 space-y-1.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {Object.entries(gastosPorMetodo).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${metodoBadge[key]}`}>
                      {METODOS.find(m => m.value === key)?.label}
                    </span>
                  </div>
                  <span className="font-mono text-red-400">${fmt(val)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold">
                <span className="text-sm">Total gastos</span>
                <span className="font-mono text-red-400">${fmt(totalGastos)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resumen final */}
      <div className="rounded-xl p-6 border" style={{ background: balance >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: balance >= 0 ? '#10b981' : '#ef4444' }}>
        <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Resumen del evento</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>Ingresos netos</span>
            <span className="font-mono font-bold text-emerald-400">+ ${fmt(totalIngresos)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>Gastos</span>
            <span className="font-mono font-bold text-red-400">− ${fmt(totalGastos)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t text-base font-bold" style={{ borderColor: 'var(--color-border)' }}>
            <span>Balance final</span>
            <span className={`font-mono ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {balance >= 0 ? '+' : ''}{fmt(balance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
