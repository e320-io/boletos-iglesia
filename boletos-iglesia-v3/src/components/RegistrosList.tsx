'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import type { Registro, Nacion } from '@/types';

interface Props {
  registros: Registro[];
  naciones: Nacion[];
  onSelect: (r: Registro) => void;
  onRefresh: () => void;
  privacyMode?: boolean;
  showCheckIn?: boolean;
  showCheckIn2?: boolean;
  eventoId?: string;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  userRole?: string;
  isFreeEvent?: boolean;
}

export default function RegistrosList({ registros, naciones, onSelect, onRefresh, privacyMode = false, showCheckIn = false, showCheckIn2 = false, eventoId, addToast, userRole = 'admin', isFreeEvent = false }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const canSeeMoney = userRole !== 'registro' && !isFreeEvent;
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterNacion, setFilterNacion] = useState<string>('todos');
  const [filterCheckIn, setFilterCheckIn] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [showCorte, setShowCorte] = useState(false);

  const hasTipos = registros.some(r => (r as any).tipo && (r as any).tipo !== 'general');
  const encuentristas = registros.filter(r => (r as any).tipo === 'Encuentrista').length;
  const servidores = registros.filter(r => (r as any).tipo === 'Servidor').length;

  const filtered = registros.filter(r => {
    const matchSearch = !search || r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.telefono?.includes(search) || r.correo?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchNacion = filterNacion === 'todos' || r.nacion_id === filterNacion;
    const matchCheckIn = filterCheckIn === 'todos' ||
      (filterCheckIn === 'checked_1' && (r as any).checked_in) ||
      (filterCheckIn === 'unchecked_1' && !(r as any).checked_in) ||
      (filterCheckIn === 'checked_2' && (r as any).checked_in_2) ||
      (filterCheckIn === 'unchecked_2' && !(r as any).checked_in_2);
    const matchTipo = filterTipo === 'todos' || (r as any).tipo === filterTipo;
    return matchSearch && matchStatus && matchNacion && matchCheckIn && matchTipo;
  });

  const handleCheckIn = async (e: React.MouseEvent, registro: Registro) => {
    e.stopPropagation();
    const isCheckedIn = (registro as any).checked_in;
    const { error } = await supabase
      .from('registros')
      .update({ checked_in: !isCheckedIn, checked_in_at: !isCheckedIn ? new Date().toISOString() : null })
      .eq('id', registro.id);
    if (error) addToast?.('error', 'Error al actualizar check-in');
    else {
      addToast?.('success', !isCheckedIn ? `✓ Check-in: ${registro.nombre}` : `Check-in removido: ${registro.nombre}`);
      if (user && !isCheckedIn) {
        logActivity({ userId: user.id, userName: user.nombre, action: 'checkin_dia1', detail: registro.nombre, eventoId: eventoId, registroId: registro.id });
      }
      onRefresh();
    }
  };

  const handleCheckIn2 = async (e: React.MouseEvent, registro: Registro) => {
    e.stopPropagation();
    const isCheckedIn2 = (registro as any).checked_in_2;
    const { error } = await supabase
      .from('registros')
      .update({ checked_in_2: !isCheckedIn2, checked_in_2_at: !isCheckedIn2 ? new Date().toISOString() : null })
      .eq('id', registro.id);
    if (error) addToast?.('error', 'Error al actualizar check-in día 2');
    else {
      addToast?.('success', !isCheckedIn2 ? `✓ Check-in Día 2: ${registro.nombre}` : `Check-in Día 2 removido: ${registro.nombre}`);
      if (user && !isCheckedIn2) {
        logActivity({ userId: user.id, userName: user.nombre, action: 'checkin_dia2', detail: registro.nombre, eventoId: eventoId, registroId: registro.id });
      }
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
  const checkedIn2Count = filtered.filter(r => (r as any).checked_in_2).length;
  const blurStyle = privacyMode ? { filter: 'blur(8px)', userSelect: 'none' as const } : {};

  // Corte de caja: transactions from today (using Mexico City timezone)
  const todayMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
  const allPagos = registros.flatMap(r => (r.pagos || []).map((p: any) => ({ ...p, registroNombre: r.nombre })));
  const pagosHoy = allPagos.filter((p: any) => {
    if (!p.created_at) return false;
    const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return pagoDateMX === todayMX;
  });
  const corteEfectivo = pagosHoy.filter((p: any) => p.metodo_pago === 'efectivo').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const corteTarjeta = pagosHoy.filter((p: any) => p.metodo_pago === 'tarjeta').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const corteTransferencia = pagosHoy.filter((p: any) => p.metodo_pago === 'transferencia').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const corteOtro = pagosHoy.filter((p: any) => p.metodo_pago === 'otro').reduce((s: number, p: any) => s + Number(p.monto), 0);
  const corteTotal = corteEfectivo + corteTarjeta + corteTransferencia + corteOtro;

  return (
    <div>
      {/* Filters */}
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
        {hasTipos && (
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los tipos</option>
            <option value="Encuentrista">Encuentrista</option>
            <option value="Servidor">Servidor</option>
          </select>
        )}
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
            <option value="checked_1">✓ Día 1: Con check-in</option>
            <option value="unchecked_1">✗ Día 1: Sin check-in</option>
            {showCheckIn2 && <option value="checked_2">✓ Día 2: Con check-in</option>}
            {showCheckIn2 && <option value="unchecked_2">✗ Día 2: Sin check-in</option>}
          </select>
        )}
        <button onClick={() => setShowCorte(!showCorte)}
          className={`px-4 py-2.5 rounded-lg text-sm border transition-all ${showCorte ? 'border-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
          style={showCorte ? { background: 'rgba(0,188,212,0.15)', borderColor: 'var(--color-accent)' } : { borderColor: 'var(--color-border)' }}>
          💰 Corte de caja
        </button>
        <button onClick={async () => {
          addToast?.('info', 'Generando PDF...');
          try {
            // Dynamic import of jsPDF and autoTable
            const jsPDFModule = await import('jspdf');
            const jsPDF = jsPDFModule.default;
            const autoTableModule = await import('jspdf-autotable');

            const doc = new jsPDF('portrait', 'mm', 'letter');

            // Build subtitle with active filters
            const filterParts: string[] = [];
            if (filterStatus !== 'todos') filterParts.push(`Status: ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`);
            if (filterTipo !== 'todos') filterParts.push(`Tipo: ${filterTipo}`);
            if (filterNacion !== 'todos') {
              const nacionName = naciones.find(n => n.id === filterNacion)?.nombre || '';
              filterParts.push(`Nación: ${nacionName}`);
            }
            if (filterCheckIn === 'checked') filterParts.push('Con check-in');
            if (filterCheckIn === 'unchecked') filterParts.push('Sin check-in');
            if (search) filterParts.push(`Búsqueda: "${search}"`);
            const subtitle = filterParts.length > 0 ? filterParts.join(' · ') : 'Todos los registros';

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Lista de Asistentes', 14, 20);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text(subtitle, 14, 27);
            doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 33);
            doc.text(`Total: ${filtered.length} registros`, 14, 39);
            doc.setTextColor(0, 0, 0);

            // Table data
            const tableData = filtered.map((r, i) => {
              const nacionNombre = (r as any).nacion?.nombre || '—';
              const tipo = (r as any).tipo || 'general';
              const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
              return [
                (i + 1).toString(),
                r.nombre,
                nacionNombre,
                tipo,
                statusLabel,
              ];
            });

            // AutoTable
            (doc as any).autoTable({
              startY: 44,
              head: [['#', 'Nombre', 'Nación', 'Tipo', 'Status']],
              body: tableData,
              theme: 'grid',
              headStyles: {
                fillColor: [30, 58, 95],
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold',
              },
              bodyStyles: {
                fontSize: 8,
                cellPadding: 3,
              },
              columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 65 },
                2: { cellWidth: 55 },
                3: { cellWidth: 28 },
                4: { cellWidth: 25, halign: 'center' },
              },
              alternateRowStyles: {
                fillColor: [245, 247, 250],
              },
              didDrawPage: (data: any) => {
                // Footer with page number
                const pageCount = (doc as any).internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                  `Página ${data.pageNumber} de ${pageCount}`,
                  doc.internal.pageSize.getWidth() / 2,
                  doc.internal.pageSize.getHeight() - 10,
                  { align: 'center' }
                );
              },
            });

            // Save
            const fileName = `asistentes${filterStatus !== 'todos' ? '_' + filterStatus : ''}${filterTipo !== 'todos' ? '_' + filterTipo.toLowerCase() : ''}.pdf`;
            doc.save(fileName);
            addToast?.('success', `PDF exportado: ${filtered.length} registros`);
          } catch (err: any) {
            console.error(err);
            addToast?.('error', 'Error al generar PDF. Intenta de nuevo.');
          }
        }}
          className="px-4 py-2.5 rounded-lg text-sm border transition-all text-slate-400 hover:text-white hover:border-red-400"
          style={{ borderColor: 'var(--color-border)' }}>
          📄 Exportar PDF
        </button>
      </div>

      {/* Corte de caja panel */}
      {showCorte && (
        <div className="rounded-xl p-6 border mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-accent)', boxShadow: '0 0 20px rgba(0,188,212,0.1)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              💰 Corte de Caja — Hoy {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(0,188,212,0.1)', color: 'var(--color-accent)' }}>
              {pagosHoy.length} transacciones
            </span>
          </div>
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>${corteTotal.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total del día</div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold text-green-400">💵 ${corteEfectivo.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Efectivo</div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold text-blue-400">💳 ${corteTarjeta.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Tarjeta</div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold text-purple-400">🏦 ${corteTransferencia.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Transferencia</div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold text-slate-400">📋 ${corteOtro.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Otro</div>
            </div>
          </div>
          {pagosHoy.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-xs">
                <thead><tr style={{ background: 'var(--color-bg)' }}>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Persona</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Método</th>
                  <th className="text-right px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Monto</th>
                  <th className="text-right px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Hora</th>
                </tr></thead>
                <tbody>
                  {pagosHoy.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((p: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-3 py-2">{(p as any).registroNombre}</td>
                      <td className="px-3 py-2">
                        {p.metodo_pago === 'efectivo' ? '💵' : p.metodo_pago === 'tarjeta' ? '💳' : p.metodo_pago === 'transferencia' ? '🏦' : '📋'} {p.metodo_pago}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-400">${Number(p.monto).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagosHoy.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No hay transacciones registradas hoy</p>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className={`grid ${hasTipos ? 'grid-cols-6' : showCheckIn ? 'grid-cols-5' : 'grid-cols-4'} gap-4 mb-6`}>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{filtered.length}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Registros</div>
        </div>
        {hasTipos && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex gap-3">
              <div>
                <div className="text-lg font-bold text-slate-300">{encuentristas}</div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Encuentristas</div>
              </div>
              <div className="border-l pl-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-lg font-bold text-purple-400">{servidores}</div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Servidores</div>
              </div>
            </div>
          </div>
        )}
        {showCheckIn && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex gap-3">
              <div>
                <div className="text-lg font-bold text-emerald-400">{checkedInCount}</div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{showCheckIn2 ? 'Día 1' : 'Check-in'}</div>
              </div>
              {showCheckIn2 && (
                <div className="border-l pl-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-lg font-bold text-orange-400">{checkedIn2Count}</div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Día 2</div>
                </div>
              )}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Check-in</div>
          </div>
        )}
        {!isFreeEvent && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-2xl font-bold text-emerald-400">{filtered.filter(r => r.status === 'liquidado').length}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Liquidados</div>
          </div>
        )}
        {canSeeMoney && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-2xl font-bold text-emerald-400" style={blurStyle}>${totalRecaudado.toLocaleString()}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Recaudado</div>
          </div>
        )}
        {canSeeMoney && (
          <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-2xl font-bold text-amber-400" style={blurStyle}>${totalPorCobrar.toLocaleString()}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Por cobrar</div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-bg)' }}>
              {showCheckIn && <th className="text-center px-3 py-3 font-medium" style={{ color: '#10b981' }}>{showCheckIn2 ? 'Día 1' : 'Check-in'}</th>}
              {showCheckIn2 && <th className="text-center px-3 py-3 font-medium" style={{ color: '#f97316' }}>Día 2</th>}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
              {hasTipos && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Tipo</th>}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nación</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              {canSeeMoney && <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Pagado</th>}
              {canSeeMoney && <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Saldo</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const saldo = Number(r.monto_total) - Number(r.monto_pagado);
              const isCheckedIn = (r as any).checked_in;
              const isCheckedIn2 = (r as any).checked_in_2;
              return (
                <tr key={r.id} onClick={() => onSelect(r)}
                  className={`cursor-pointer transition-colors hover:bg-white/5 border-t`}
                  style={{ borderColor: 'var(--color-border)' }}>
                  {showCheckIn && (
                    <td className="text-center px-3 py-3">
                      <button onClick={(e) => handleCheckIn(e, r)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all text-sm font-bold ${
                          isCheckedIn ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600 text-transparent hover:border-slate-400'}`}>✓</button>
                    </td>
                  )}
                  {showCheckIn2 && (
                    <td className="text-center px-3 py-3">
                      <button onClick={(e) => handleCheckIn2(e, r)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all text-sm font-bold ${
                          isCheckedIn2 ? 'bg-orange-500 border-orange-400 text-white' : 'border-slate-600 text-transparent hover:border-slate-400'}`}>✓</button>
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  {hasTipos && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${(r as any).tipo === 'Servidor' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-500/20 text-slate-400'}`}>
                        {(r as any).tipo || 'general'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (r as any).nacion?.color || '#666' }} />
                      <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>{(r as any).nacion?.nombre || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${statusColors[r.status]}`}>{statusLabels[r.status]}</span>
                  </td>
                  {canSeeMoney && <td className="px-4 py-3 text-right font-medium" style={blurStyle}>${Number(r.monto_pagado).toLocaleString()}</td>}
                  {canSeeMoney && (
                    <td className="px-4 py-3 text-right" style={blurStyle}>
                      {saldo > 0 ? <span className="text-amber-400 font-medium">${saldo.toLocaleString()}</span> : <span className="text-emerald-400">$0</span>}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>No se encontraron registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
