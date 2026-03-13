'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Registro, Nacion } from '@/types';

interface Props {
  registros: Registro[];
  naciones: Nacion[];
  onSelect: (r: Registro) => void;
  onRefresh: () => void;
  privacyMode?: boolean;
  showCheckIn?: boolean;
  eventoId?: string;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function RegistrosList({ registros, naciones, onSelect, onRefresh, privacyMode = false, showCheckIn = false, eventoId, addToast }: Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterNacion, setFilterNacion] = useState<string>('todos');
  const [filterCheckIn, setFilterCheckIn] = useState<string>('todos');

  const filtered = registros.filter(r => {
    const matchSearch = !search || r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.telefono?.includes(search) || r.correo?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchNacion = filterNacion === 'todos' || r.nacion_id === filterNacion;
    const matchCheckIn = filterCheckIn === 'todos' ||
      (filterCheckIn === 'checked' && (r as any).checked_in) ||
      (filterCheckIn === 'unchecked' && !(r as any).checked_in);
    return matchSearch && matchStatus && matchNacion && matchCheckIn;
  });

  const handleCheckIn = async (e: React.MouseEvent, registro: Registro) => {
    e.stopPropagation();
    const isCheckedIn = (registro as any).checked_in;
    const { error } = await supabase
      .from('registros')
      .update({
        checked_in: !isCheckedIn,
        checked_in_at: !isCheckedIn ? new Date().toISOString() : null,
      })
      .eq('id', registro.id);

    if (error) {
      addToast?.('error', 'Error al actualizar check-in');
    } else {
      addToast?.('success', !isCheckedIn ? `✓ Check-in: ${registro.nombre}` : `Check-in removido: ${registro.nombre}`);
      onRefresh();
    }
  };

  const statusColors: Record<string, string> = {
    pendiente: 'bg-red-500/20 text-red-400 border-red-500/30',
    abono: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    liquidado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  const statusLabels: Record<string, string> = { pendiente: 'Pendiente', abono: 'Abono', liquidado: 'Liquidado' };

  const totalRecaudado = filtered.reduce((s, r) => s + Number(r.monto_pagado), 0);
  const totalPorCobrar = filtered.reduce((s, r) => s + (Number(r.monto_total) - Number(r.monto_pagado)), 0);
  const checkedInCount = filtered.filter(r => (r as any).checked_in).length;

  const blurStyle = privacyMode ? { filter: 'blur(8px)', userSelect: 'none' as const } : {};

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o correo..."
          className="flex-1 min-w-[250px] px-4 py-2.5 rounded-lg text-sm border bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-lg text-sm border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="abono">Abono</option>
          <option value="liquidado">Liquidado</option>
        </select>
        <select value={filterNacion} onChange={e => setFilterNacion(e.target.value)}
          className="px-4 py-2.5 rounded-lg text-sm border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          <option value="todos">Todas las naciones</option>
          {naciones.map(n => (<option key={n.id} value={n.id}>{n.nombre}</option>))}
        </select>
        {showCheckIn && (
          <select value={filterCheckIn} onChange={e => setFilterCheckIn(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Check-in: Todos</option>
            <option value="checked">✓ Con check-in</option>
            <option value="unchecked">✗ Sin check-in</option>
          </select>
        )}
      </div>

      <div className={`grid ${showCheckIn ? 'grid-cols-5' : 'grid-cols-4'} gap-4 mb-6`}>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{filtered.length}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Registros</div>
        </div>
        {showCheckIn && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-2xl font-bold text-purple-400">{checkedInCount} / {filtered.length}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Check-in</div>
          </div>
        )}
        <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold text-emerald-400">{filtered.filter(r => r.status === 'liquidado').length}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Liquidados</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold text-emerald-400" style={blurStyle}>${totalRecaudado.toLocaleString()}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Recaudado</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold text-amber-400" style={blurStyle}>${totalPorCobrar.toLocaleString()}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Por cobrar</div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-bg)' }}>
              {showCheckIn && <th className="text-center px-3 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Check-in</th>}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Tipo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nación</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Pagado</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const saldo = Number(r.monto_total) - Number(r.monto_pagado);
              const isCheckedIn = (r as any).checked_in;
              return (
                <tr key={r.id} onClick={() => onSelect(r)}
                  className={`cursor-pointer transition-colors hover:bg-white/5 border-t ${isCheckedIn ? 'bg-emerald-500/5' : ''}`}
                  style={{ borderColor: 'var(--color-border)' }}>
                  {showCheckIn && (
                    <td className="text-center px-3 py-3">
                      <button onClick={(e) => handleCheckIn(e, r)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all text-sm font-bold ${
                          isCheckedIn ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600 text-transparent hover:border-slate-400'
                        }`}>
                        ✓
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(r as any).tipo === 'Servidor' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-500/20 text-slate-400'}`}>
                      {(r as any).tipo || 'general'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (r as any).nacion?.color || '#666' }} />
                      <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>{(r as any).nacion?.nombre || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${statusColors[r.status]}`}>{statusLabels[r.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={blurStyle}>${Number(r.monto_pagado).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right" style={blurStyle}>
                    {saldo > 0 ? <span className="text-amber-400 font-medium">${saldo.toLocaleString()}</span> : <span className="text-emerald-400">$0</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={showCheckIn ? 7 : 6} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>No se encontraron registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
