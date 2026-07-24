'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import type { Registro, Nacion } from '@/types';
import { seatLabel } from '@/lib/seatLabel';
import { METODOS_PAGO } from '@/lib/constants';

interface Props {
  registros: Registro[];
  naciones: Nacion[];
  equipos?: any[];
  areasServicio?: any[];
  onSelect: (r: Registro) => void;
  onRefresh: () => void;
  privacyMode?: boolean;
  showCheckIn?: boolean;
  showCheckIn2?: boolean;
  eventoId?: string;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  userRole?: string;
  isFreeEvent?: boolean;
  readOnly?: boolean;
  tieneAsientos?: boolean;
}

export default function RegistrosList({ registros, naciones, equipos = [], areasServicio = [], onSelect, onRefresh, privacyMode = false, showCheckIn = false, showCheckIn2 = false, eventoId, addToast, userRole = 'admin', isFreeEvent = false, readOnly = false, tieneAsientos = false }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const canSeeMoney = userRole !== 'registro' && !isFreeEvent;
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterNacion, setFilterNacion] = useState<string>('todos');
  const [filterEquipo, setFilterEquipo] = useState<string>('todos');
  const [filterCheckIn, setFilterCheckIn] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterMetodoPago, setFilterMetodoPago] = useState<string>('todos');
  const [showCorte, setShowCorte] = useState(false);
  const [showColumnas, setShowColumnas] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number; current: string } | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFilterEmails, setBulkFilterEmails] = useState('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    telefono: false,
    correo: false,
    tipo: true,
    rol: true,
    grupo: true,
    asiento: true,
    status: true,
    pagado: true,
    saldo: true,
  });
  const toggleColumn = (col: string) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));

  const hasEquipos = equipos.length > 0;
  // Conferencistas have their own tab; exclude them from the main list
  const regularRegistros = registros.filter(r => (r as any).tipo !== 'conferencista');
  const hasTipos = regularRegistros.some(r => (r as any).tipo && (r as any).tipo !== 'general');
  const hasRoles = regularRegistros.some(r => (r as any).rol);
  const encuentristas = regularRegistros.filter(r => (r as any).tipo === 'Encuentrista').length;
  const servidores = regularRegistros.filter(r => (r as any).tipo === 'Servidor').length;

  const filtered = regularRegistros.filter(r => {
    const matchSearch = !search || r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.telefono?.includes(search) || r.correo?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchNacion = filterNacion === 'todos' || r.nacion_id === filterNacion;
    const matchEquipo = filterEquipo === 'todos' || (r as any).equipo_id === filterEquipo;
    const matchCheckIn = filterCheckIn === 'todos' ||
      (filterCheckIn === 'checked_1' && (r as any).checked_in) ||
      (filterCheckIn === 'unchecked_1' && !(r as any).checked_in) ||
      (filterCheckIn === 'checked_2' && (r as any).checked_in_2) ||
      (filterCheckIn === 'unchecked_2' && !(r as any).checked_in_2);
    const matchTipo = filterTipo === 'todos' || (r as any).tipo === filterTipo;
    const matchMetodo = filterMetodoPago === 'todos' ||
      (r.pagos || []).some(p => p.metodo_pago === filterMetodoPago);
    return matchSearch && matchStatus && matchNacion && matchEquipo && matchCheckIn && matchTipo && matchMetodo;
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

  const handleBulkResend = () => {
    const allLiquidados = regularRegistros.filter(r => r.correo && r.status === 'liquidado');
    if (allLiquidados.length === 0) {
      addToast?.('info', 'No hay asistentes liquidados con correo registrado');
      return;
    }
    setShowBulkModal(true);
  };

  const executeBulkSend = async () => {
    const allLiquidados = regularRegistros.filter(r => r.correo && r.status === 'liquidado');
    const filterList = bulkFilterEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const targets = filterList.length > 0
      ? allLiquidados.filter(r => filterList.includes(r.correo!.toLowerCase()))
      : allLiquidados;

    if (targets.length === 0) {
      addToast?.('info', 'Ningún correo coincide con asistentes liquidados');
      return;
    }

    setShowBulkModal(false);
    setSendingBulk(true);
    let sent = 0;
    let errors = 0;
    for (const reg of targets) {
      setBulkProgress({ sent, total: targets.length, current: reg.nombre });
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registroId: reg.id,
            ...(bulkSubject.trim() ? { subjectOverride: bulkSubject.trim() } : {}),
          }),
        });
        sent++;
      } catch {
        errors++;
      }
    }
    setSendingBulk(false);
    setBulkProgress(null);
    setBulkFilterEmails('');
    setBulkSubject('');
    if (errors === 0) {
      addToast?.('success', `Boletos enviados a ${sent} asistente${sent > 1 ? 's' : ''}`);
    } else {
      addToast?.('info', `Enviados: ${sent} · Errores: ${errors}`);
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
    reembolsado: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  const statusLabels: Record<string, string> = { pendiente: 'Pendiente', abono: 'Abono', liquidado: 'Liquidado', reembolsado: 'Reembolsado' };

  const totalRecaudado = filtered.reduce((s, r) => s + Number(r.monto_pagado), 0);
  const totalPorCobrar = filtered.reduce((s, r) => s + (Number(r.monto_total) - Number(r.monto_pagado)), 0);
  const checkedInCount = filtered.filter(r => (r as any).checked_in).length;
  const checkedIn2Count = filtered.filter(r => (r as any).checked_in_2).length;
  const blurStyle = privacyMode ? { filter: 'blur(8px)', userSelect: 'none' as const } : {};

  // Corte de caja: transactions from today (using Mexico City timezone)
  const todayMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
  const allPagos = registros.flatMap(r => (r.pagos || []).map((p: any) => ({ ...p, registroNombre: r.nombre })));
  const pagosHoy = allPagos.filter((p: any) => {
    if (p.reembolsado || !p.created_at) return false;
    const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return pagoDateMX === todayMX;
  });
  // Reembolsos procesados hoy: el dinero sale de caja hoy aunque el pago original sea de otro día
  const reembolsosHoy = allPagos.filter((p: any) => {
    if (!p.reembolsado || !p.reembolsado_at) return false;
    const reembolsoDateMX = new Date(p.reembolsado_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return reembolsoDateMX === todayMX;
  });
  const netoPorMetodo = (metodo: string) =>
    pagosHoy.filter((p: any) => p.metodo_pago === metodo).reduce((s: number, p: any) => s + Number(p.monto), 0) -
    reembolsosHoy.filter((p: any) => p.metodo_pago === metodo).reduce((s: number, p: any) => s + Number(p.monto_reembolsado), 0);
  const corteEfectivo = netoPorMetodo('efectivo');
  const corteTarjeta = netoPorMetodo('tarjeta');
  const corteTransferencia = netoPorMetodo('transferencia');
  const corteOtro = netoPorMetodo('otro');
  const corteStripe = netoPorMetodo('stripe');
  const corteTotal = corteEfectivo + corteTarjeta + corteTransferencia + corteOtro + corteStripe;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o correo..."
          className="flex-1 min-w-[250px] px-4 py-2.5 rounded-lg text-sm border bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
        {!isFreeEvent && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="abono">Abono</option>
            <option value="liquidado">Liquidado</option>
            <option value="reembolsado">Reembolsado</option>
          </select>
        )}
        {!isFreeEvent && canSeeMoney && (
          <select value={filterMetodoPago} onChange={e => setFilterMetodoPago(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los métodos</option>
            {METODOS_PAGO.map(m => (<option key={m.value} value={m.value}>{m.icon} {m.label}</option>))}
          </select>
        )}
        {hasTipos && (
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los tipos</option>
            <option value="Encuentrista">Encuentrista</option>
            <option value="Servidor">Servidor</option>
          </select>
        )}
        {!hasEquipos && (
          <select value={filterNacion} onChange={e => setFilterNacion(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todas las naciones</option>
            {naciones.map(n => (<option key={n.id} value={n.id}>{n.nombre}</option>))}
          </select>
        )}
        {hasEquipos && (
          <select value={filterEquipo} onChange={e => setFilterEquipo(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los equipos</option>
            {equipos.map(eq => (<option key={eq.id} value={eq.id}>{eq.nombre}</option>))}
          </select>
        )}
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
        {!readOnly && (
          <button onClick={() => setShowCorte(!showCorte)}
            className={`px-4 py-2.5 rounded-lg text-sm border transition-all ${showCorte ? 'border-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
            style={showCorte ? { background: 'rgba(0,188,212,0.15)', borderColor: 'var(--color-accent)' } : { borderColor: 'var(--color-border)' }}>
            💰 Corte de caja
          </button>
        )}
        <div className="relative">
          <button onClick={() => setShowColumnas(!showColumnas)}
            className={`px-4 py-2.5 rounded-lg text-sm border transition-all ${showColumnas ? 'border-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}
            style={showColumnas ? { background: 'rgba(139,92,246,0.15)', borderColor: '#8b5cf6' } : { borderColor: 'var(--color-border)' }}>
            🗂 Columnas
          </button>
          {showColumnas && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColumnas(false)} />
              <div className="absolute left-0 top-full mt-2 z-50 rounded-xl border p-3 min-w-[200px] shadow-xl"
              style={{ background: 'var(--color-surface)', borderColor: '#8b5cf6' }}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Columnas visibles</p>
              {[
                { key: 'telefono', label: 'Teléfono' },
                { key: 'correo', label: 'Correo' },
                ...(hasTipos ? [{ key: 'tipo', label: 'Tipo' }] : []),
                ...(hasRoles ? [{ key: 'rol', label: 'Rol' }] : []),
                { key: 'grupo', label: hasEquipos ? 'Equipo' : 'Nación' },
                ...(tieneAsientos ? [{ key: 'asiento', label: 'Asiento' }] : []),
                ...(!isFreeEvent ? [{ key: 'status', label: 'Status' }] : []),
                ...(canSeeMoney ? [{ key: 'pagado', label: 'Pagado' }, { key: 'saldo', label: 'Saldo' }] : []),
              ].map(col => (
                <label key={col.key} className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-white transition-colors text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => toggleColumn(col.key)}
                    className="accent-violet-500 w-3.5 h-3.5" />
                  {col.label}
                </label>
              ))}
            </div>
            </>
          )}
        </div>
        {!readOnly && !isFreeEvent && (
          <button onClick={handleBulkResend} disabled={sendingBulk}
            className="px-4 py-2.5 rounded-lg text-sm border transition-all text-slate-400 hover:text-white hover:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)' }}>
            {sendingBulk && bulkProgress
              ? `Enviando ${bulkProgress.sent}/${bulkProgress.total}…`
              : `✉️ Reenviar boletos (${regularRegistros.filter(r => r.correo && r.status === 'liquidado').length})`}
          </button>
        )}
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
            if (!hasEquipos && filterNacion !== 'todos') {
              const nacionName = naciones.find(n => n.id === filterNacion)?.nombre || '';
              filterParts.push(`Nación: ${nacionName}`);
            }
            if (hasEquipos && filterEquipo !== 'todos') {
              const equipoName = equipos.find(eq => eq.id === filterEquipo)?.nombre || '';
              filterParts.push(`Equipo: ${equipoName}`);
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

            // Table data — driven by visibleColumns
            const headRow: string[] = ['#', 'Nombre'];
            if (visibleColumns.telefono) headRow.push('Teléfono');
            if (visibleColumns.correo) headRow.push('Correo');
            if (hasTipos && visibleColumns.tipo) headRow.push('Tipo');
            if (hasRoles && visibleColumns.rol) headRow.push('Rol');
            if (visibleColumns.grupo) headRow.push(hasEquipos ? 'Equipo' : 'Nación');
            if (tieneAsientos && visibleColumns.asiento) headRow.push('Asiento');
            if (!isFreeEvent && visibleColumns.status) headRow.push('Status');
            if (canSeeMoney && visibleColumns.pagado) headRow.push('Pagado');
            if (canSeeMoney && visibleColumns.saldo) headRow.push('Saldo');

            const tableData = filtered.map((r, i) => {
              const row: string[] = [(i + 1).toString(), r.nombre];
              if (visibleColumns.telefono) row.push(r.telefono || '—');
              if (visibleColumns.correo) row.push(r.correo || '—');
              if (hasTipos && visibleColumns.tipo) row.push((r as any).tipo || 'general');
              if (hasRoles && visibleColumns.rol) row.push((r as any).rol || '—');
              if (visibleColumns.grupo) row.push(hasEquipos
                ? ((r as any).tipo === 'Servidor' ? ((r as any).area_servicio?.nombre || '—') : ((r as any).equipo?.nombre || '—'))
                : ((r as any).nacion?.nombre || '—'));
              if (tieneAsientos && visibleColumns.asiento) row.push(r.asientos && r.asientos.length > 0 ? r.asientos.map(a => seatLabel(a)).join(', ') : '—');
              if (!isFreeEvent && visibleColumns.status) row.push(r.status.charAt(0).toUpperCase() + r.status.slice(1));
              if (canSeeMoney && visibleColumns.pagado) row.push(`$${Number(r.monto_pagado).toLocaleString()}`);
              if (canSeeMoney && visibleColumns.saldo) row.push(`$${(Number(r.monto_total) - Number(r.monto_pagado)).toLocaleString()}`);
              return row;
            });

            // AutoTable
            (doc as any).autoTable({
              startY: 44,
              head: [headRow],
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
            const fileNameParts = ['asistentes'];
            if (filterStatus !== 'todos') fileNameParts.push(filterStatus);
            if (filterTipo !== 'todos') fileNameParts.push(filterTipo.toLowerCase());
            if (!hasEquipos && filterNacion !== 'todos') {
              const nacionName = naciones.find(n => n.id === filterNacion)?.nombre || '';
              fileNameParts.push(nacionName.toLowerCase().replace(/\s+/g, '_'));
            }
            if (hasEquipos && filterEquipo !== 'todos') {
              const equipoName = equipos.find(eq => eq.id === filterEquipo)?.nombre || '';
              fileNameParts.push(equipoName.toLowerCase().replace(/\s+/g, '_'));
            }
            if (filterCheckIn !== 'todos') fileNameParts.push(filterCheckIn);
            if (search) fileNameParts.push('busqueda');
            const fileName = fileNameParts.join('_') + '.pdf';
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
          <div className="grid grid-cols-6 gap-4 mb-4">
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
              <div className="text-2xl font-bold text-indigo-400">⚡ ${corteStripe.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Stripe</div>
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
                        {p.metodo_pago === 'efectivo' ? '💵' : p.metodo_pago === 'tarjeta' ? '💳' : p.metodo_pago === 'transferencia' ? '🏦' : p.metodo_pago === 'stripe' ? '⚡' : '📋'} {p.metodo_pago === 'stripe' ? 'Stripe (en línea)' : p.metodo_pago}
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
              {tieneAsientos && visibleColumns.asiento && <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Asiento</th>}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
              {visibleColumns.telefono && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Teléfono</th>}
              {visibleColumns.correo && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Correo</th>}
              {hasTipos && visibleColumns.tipo && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Tipo</th>}
              {hasRoles && visibleColumns.rol && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Rol</th>}
              {visibleColumns.grupo && (hasEquipos
                ? <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Equipo</th>
                : <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nación</th>
              )}
              {!isFreeEvent && visibleColumns.status && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>}
              {canSeeMoney && visibleColumns.pagado && <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Pagado</th>}
              {canSeeMoney && visibleColumns.saldo && <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Saldo</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const saldo = Number(r.monto_total) - Number(r.monto_pagado);
              const isCheckedIn = (r as any).checked_in;
              const isCheckedIn2 = (r as any).checked_in_2;
              return (
                <tr key={r.id} onClick={readOnly ? undefined : () => onSelect(r)}
                  className={`${readOnly ? '' : 'cursor-pointer hover:bg-white/5'} transition-colors border-t`}
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
                  {tieneAsientos && visibleColumns.asiento && (
                    <td className="px-4 py-3 text-center">
                      {(r.asientos && r.asientos.length > 0)
                        ? <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                            {r.asientos.map(a => seatLabel(a)).join(', ')}
                          </span>
                        : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  {visibleColumns.telefono && <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.telefono || '—'}</td>}
                  {visibleColumns.correo && <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.correo || '—'}</td>}
                  {hasTipos && visibleColumns.tipo && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${(r as any).tipo === 'Servidor' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-500/20 text-slate-400'}`}>
                        {(r as any).tipo || 'general'}
                      </span>
                    </td>
                  )}
                  {hasRoles && visibleColumns.rol && (
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{(r as any).rol || '—'}</td>
                  )}
                  {visibleColumns.grupo && (hasEquipos ? (
                    (r as any).tipo === 'Servidor' ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (r as any).area_servicio?.color || '#666' }} />
                          <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>{(r as any).area_servicio?.nombre || '—'}</span>
                        </div>
                      </td>
                    ) : (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (r as any).equipo?.color || '#666' }} />
                        <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>{(r as any).equipo?.nombre || '—'}</span>
                      </div>
                    </td>
                    )
                  ) : (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (r as any).nacion?.color || '#666' }} />
                        <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>{(r as any).nacion?.nombre || '—'}</span>
                      </div>
                    </td>
                  ))}
                  {!isFreeEvent && visibleColumns.status && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${statusColors[r.status]}`}>{statusLabels[r.status]}</span>
                    </td>
                  )}
                  {canSeeMoney && visibleColumns.pagado && <td className="px-4 py-3 text-right font-medium" style={blurStyle}>${Number(r.monto_pagado).toLocaleString()}</td>}
                  {canSeeMoney && visibleColumns.saldo && (
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
    {showBulkModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="rounded-xl border w-full max-w-md p-6 shadow-2xl" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>✉️ Reenviar boletos</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Filtrar por correos <span className="opacity-50">(separados por coma — vacío = todos los liquidados)</span>
              </label>
              <textarea
                value={bulkFilterEmails}
                onChange={e => setBulkFilterEmails(e.target.value)}
                placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent resize-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Asunto del correo <span className="opacity-50">(vacío = asunto predeterminado)</span>
              </label>
              <input
                type="text"
                value={bulkSubject}
                onChange={e => setBulkSubject(e.target.value)}
                placeholder="Ej: Recordatorio Legacy Women"
                className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            {(() => {
              const allLiquidados = regularRegistros.filter(r => r.correo && r.status === 'liquidado');
              const filterList = bulkFilterEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
              const preview = filterList.length > 0
                ? allLiquidados.filter(r => filterList.includes(r.correo!.toLowerCase()))
                : allLiquidados;
              return preview.length > 0 ? (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.2)', color: 'var(--color-text-muted)' }}>
                  Se enviará a <strong style={{ color: 'var(--color-accent)' }}>{preview.length} asistente{preview.length > 1 ? 's' : ''}</strong>:
                  <ul className="mt-1.5 space-y-0.5">
                    {preview.slice(0, 5).map(r => <li key={r.id}>· {r.nombre} &lt;{r.correo}&gt;</li>)}
                    {preview.length > 5 && <li style={{ color: 'var(--color-accent)' }}>… y {preview.length - 5} más</li>}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  Ningún correo coincide con asistentes liquidados
                </div>
              );
            })()}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setShowBulkModal(false); setBulkFilterEmails(''); setBulkSubject(''); }}
              className="flex-1 py-2.5 rounded-lg text-sm border transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Cancelar
            </button>
            <button onClick={executeBulkSend}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
