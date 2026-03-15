'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { METODOS_PAGO } from '@/lib/constants';
import type { Registro, Nacion, Asiento, MetodoPago } from '@/types';

interface Props {
  registro: Registro;
  naciones: Nacion[];
  asientos?: Asiento[];
  tieneAsientos?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function RegistroDetail({ registro, naciones, asientos = [], tieneAsientos = false, onBack, onRefresh, addToast }: Props) {
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState(registro.nombre);
  const [editTelefono, setEditTelefono] = useState(registro.telefono || '');
  const [editCorreo, setEditCorreo] = useState(registro.correo || '');
  const [editNacionId, setEditNacionId] = useState(registro.nacion_id || '');
  const [editStatus, setEditStatus] = useState(registro.status);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Seat assignment
  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState('');

  const registroAsientos = (registro.asientos || []) as any[];
  const hasAsiento = registroAsientos.length > 0;
  const isLiquidado = registro.status === 'liquidado';
  const canAssignSeat = tieneAsientos && isLiquidado && !hasAsiento;

  const availableSeats = asientos
    .filter(a => a.estado === 'disponible')
    .sort((a, b) => {
      if (a.fila !== b.fila) return a.fila.localeCompare(b.fila);
      return a.columna - b.columna;
    });

  const handleAssignSeat = async () => {
    if (!selectedSeat) { addToast('error', 'Selecciona un asiento'); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('asientos')
        .update({ estado: 'ocupado', registro_id: registro.id })
        .eq('id', selectedSeat);
      if (error) throw error;
      addToast('success', `Asiento ${selectedSeat} asignado a ${registro.nombre}`);
      setShowSeatPicker(false);
      setSelectedSeat('');
      onRefresh(); onBack();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally { setLoading(false); }
  };

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
      const { error: payError } = await supabase
        .from('pagos')
        .insert({ registro_id: registro.id, monto, metodo_pago: metodoPago, referencia: referencia.trim() || null });
      if (payError) throw payError;

      const newPagado = Number(registro.monto_pagado) + monto;
      const newStatus = newPagado >= Number(registro.monto_total) ? 'liquidado' : 'abono';

      const { error: regError } = await supabase
        .from('registros').update({ monto_pagado: newPagado, status: newStatus }).eq('id', registro.id);
      if (regError) throw regError;

      if (registro.correo) {
        try { await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registroId: registro.id }) }); } catch {}
      }

      addToast('success', `Abono de $${monto.toLocaleString()} registrado. ${newStatus === 'liquidado' ? '¡Boleto liquidado!' : ''}`);
      setMontoAbono(''); setReferencia('');
      onRefresh(); onBack();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally { setLoading(false); }
  };

  const handleEdit = async () => {
    if (!editNombre.trim()) { addToast('error', 'El nombre es requerido'); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('registros')
        .update({
          nombre: editNombre.trim(),
          telefono: editTelefono.trim() || null,
          correo: editCorreo.trim() || null,
          nacion_id: editNacionId || null,
          status: editStatus,
        })
        .eq('id', registro.id);
      if (error) throw error;

      addToast('success', 'Registro actualizado');
      setEditing(false);
      onRefresh(); onBack();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Free up assigned seats
      const { error: seatError } = await supabase
        .from('asientos')
        .update({ estado: 'disponible', registro_id: null })
        .eq('registro_id', registro.id);
      if (seatError) throw seatError;

      // Delete pagos (cascade should handle, but just in case)
      await supabase.from('pagos').delete().eq('registro_id', registro.id);

      // Delete registro
      const { error } = await supabase.from('registros').delete().eq('id', registro.id);
      if (error) throw error;

      addToast('success', `Registro de "${registro.nombre}" eliminado`);
      onRefresh(); onBack();
    } catch (error: any) {
      addToast('error', `Error al eliminar: ${error.message}`);
    } finally { setLoading(false); }
  };

  const handleResendEmail = async () => {
    if (!registro.correo) { addToast('error', 'No hay correo registrado'); return; }
    try {
      const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registroId: registro.id }) });
      const data = await res.json();
      if (res.ok) addToast('success', 'Comprobante enviado');
      else addToast('error', `Error: ${data.error || 'No se pudo enviar'}`);
    } catch (err: any) { addToast('error', `Error de red: ${err.message}`); }
  };

  const statusColors: Record<string, string> = {
    pendiente: 'bg-red-500/20 text-red-400 border-red-500/30',
    abono: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    liquidado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const metodoPagoLabels: Record<string, string> = {
    efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia', tarjeta: '💳 Tarjeta', otro: '📋 Otro',
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6 hover:underline" style={{ color: 'var(--color-accent)' }}>
        ← Volver a registros
      </button>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 border max-w-md w-full mx-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl"
                style={{ background: 'rgba(239,68,68,0.1)' }}>🗑️</div>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>¿Eliminar registro?</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Vas a eliminar el registro de <strong>{registro.nombre}</strong>. 
                Esto borra sus pagos, libera sus asientos y no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: '#ef4444' }}>
                {loading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          {/* Header card */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {!editing ? (
              <>
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
                      {(registro as any).tipo && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${(registro as any).tipo === 'Servidor' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-500/20 text-slate-400'}`}>
                          {(registro as any).tipo}
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[registro.status]}`}>
                        {registro.status.charAt(0).toUpperCase() + registro.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleResendEmail}
                      className="px-3 py-2 rounded-lg text-xs border transition-all hover:border-cyan-500"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      📧 Comprobante
                    </button>
                    <button onClick={() => setEditing(true)}
                      className="px-3 py-2 rounded-lg text-xs border transition-all hover:border-amber-500 hover:text-amber-400"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 rounded-lg text-xs border transition-all hover:border-red-500 hover:text-red-400"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Teléfono:</span><span className="ml-2">{registro.telefono || '—'}</span></div>
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Correo:</span><span className="ml-2">{registro.correo || '—'}</span></div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Asientos:</span>
                    <span className="ml-2 inline-flex gap-1">
                      {registroAsientos.length > 0
                        ? registroAsientos.map((a: any) => (
                            <span key={a.id} className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{a.id}</span>
                          ))
                        : <span style={{ color: 'var(--color-text-muted)' }}>Sin asiento</span>
                      }
                    </span>
                  </div>
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Registrado:</span><span className="ml-2">{new Date(registro.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                </div>
              </>
            ) : (
              /* Edit mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Editar Registro</h3>
                  <button onClick={() => setEditing(false)} className="text-xs hover:underline" style={{ color: 'var(--color-text-muted)' }}>Cancelar</button>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre *</label>
                  <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Teléfono</label>
                    <input type="tel" value={editTelefono} onChange={e => setEditTelefono(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Correo</label>
                    <input type="email" value={editCorreo} onChange={e => setEditCorreo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nación</label>
                  <select value={editNacionId} onChange={e => setEditNacionId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    <option value="">Sin nación</option>
                    {naciones.map(n => (<option key={n.id} value={n.id}>{n.nombre}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pendiente', 'abono', 'liquidado'] as const).map(s => (
                      <button key={s} onClick={() => setEditStatus(s)}
                        className={`px-3 py-2 rounded-lg text-sm border transition-all ${editStatus === s ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                        style={editStatus === s ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleEdit} disabled={loading}
                  className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>

          {/* Payment summary */}
          {!editing && (
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
                  <div className={`text-xl font-bold ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>${saldo.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Saldo</div>
                </div>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Number(registro.monto_total) > 0 ? Math.min(100, (Number(registro.monto_pagado) / Number(registro.monto_total)) * 100) : 0}%`,
                    background: registro.status === 'liquidado' ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  }} />
              </div>
              <div className="text-right text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {Number(registro.monto_total) > 0 ? Math.round((Number(registro.monto_pagado) / Number(registro.monto_total)) * 100) : 0}%
              </div>
            </div>
          )}

          {/* Payment history */}
          {!editing && (
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
          )}
        </div>

        {/* Right column */}
        {!editing && (
          <div className="space-y-4">
            {/* Seat assignment - only for liquidado without seat */}
            {canAssignSeat && (
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: '#f59e0b', boxShadow: '0 0 15px rgba(245,158,11,0.1)' }}>
                <h3 className="font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>🪑 Asignar Asiento</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Este boleto está liquidado. Selecciona un asiento disponible.
                </p>
                <div className="space-y-3">
                  <select value={selectedSeat} onChange={e => setSelectedSeat(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    <option value="">Seleccionar asiento...</option>
                    {availableSeats.map(a => (
                      <option key={a.id} value={a.id}>{a.id} (Fila {a.fila}, Col {a.columna})</option>
                    ))}
                  </select>
                  <button onClick={handleAssignSeat} disabled={loading || !selectedSeat}
                    className="w-full py-2.5 rounded-lg font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontFamily: 'var(--font-display)' }}>
                    {loading ? 'Asignando...' : `Asignar ${selectedSeat || 'asiento'}`}
                  </button>
                </div>
              </div>
            )}

            {/* Abono section */}
            {saldo > 0 && (
              <div className="rounded-xl p-6 border h-fit sticky top-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Registrar Abono</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Saldo pendiente</label>
                <div className="text-2xl font-bold text-amber-400">${saldo.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO.map(m => (
                    <button key={m.value} onClick={() => setMetodoPago(m.value as MetodoPago)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all flex items-center gap-2 ${metodoPago === m.value ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                      style={metodoPago === m.value ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                      <span>{m.icon}</span><span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Monto del abono</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input type="number" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} placeholder={saldo.toString()}
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm border bg-transparent"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                </div>
                <button onClick={() => setMontoAbono(saldo.toString())} className="text-xs underline mt-1" style={{ color: 'var(--color-accent)' }}>Liquidar total</button>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Referencia (opcional)</label>
                <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="# de transferencia, etc."
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <button onClick={handleAbono} disabled={loading || !montoAbono}
                className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40 glow-pulse"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                {loading ? 'Procesando...' : `Registrar Abono de $${(parseFloat(montoAbono) || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
}
