'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { METODOS_PAGO, CONF_SEAT_ROWS } from '@/lib/constants';
import { seatLabel } from '@/lib/seatLabel';
import { applyTheme, getTheme, resetTheme } from '@/lib/themes';
import { logActivity } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import type { Nacion, Registro, Asiento, MetodoPago } from '@/types';
import SeatMap from '@/components/SeatMap';
import RegistrosList from '@/components/RegistrosList';
import RegistroDetail from '@/components/RegistroDetail';
import Dashboard from '@/components/Dashboard';
import Toast from '@/components/Toast';
import CorteDeCajaModal from '@/components/CorteDeCajaModal';

type Tab = 'nuevo' | 'registros' | 'dashboard' | 'conferencistas';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface Evento {
  id: string;
  nombre: string;
  slug: string;
  fecha: string;
  precio_default: number;
  tiene_asientos: boolean;
}

export default function EventHome({ evento, onBack, userRole = 'registro', availableEventos, onEventChange }: {
  evento: Evento;
  onBack: () => void;
  userRole?: string;
  availableEventos?: Evento[];
  onEventChange?: (evento: Evento) => void;
}) {
  const theme = getTheme(evento.slug);
  const isFreeEvent = evento.precio_default === 0;
  const canRegister = userRole === 'admin' || userRole === 'registro' || userRole === 'evento';
  const canSeeDashboard = userRole === 'admin' || userRole === 'dueno';
  const canSeeRegistros = (canRegister && userRole !== 'evento') || userRole === 'dueno';
  const [tab, setTab] = useState<Tab>(userRole === 'dueno' ? 'dashboard' : (userRole === 'evento' ? 'nuevo' : 'registros'));
  const { user } = useAuth();

  // Apply event theme
  useEffect(() => {
    applyTheme(evento.slug);
    return () => { resetTheme(); };
  }, [evento.slug]);
  const [naciones, setNaciones] = useState<Nacion[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [showCorteDeCaja, setShowCorteDeCaja] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nacionId, setNacionId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [tipo, setTipo] = useState('Encuentrista');
  const [numBoletos, setNumBoletos] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [metodosPorBoleto, setMetodosPorBoleto] = useState<MetodoPago[]>([]);
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitMontos, setSplitMontos] = useState<{ metodo: MetodoPago; monto: string }[]>([
    { metodo: 'efectivo', monto: '' },
    { metodo: 'tarjeta', monto: '' },
  ]);
  const [precioBoleto, setPrecioBoleto] = useState(evento.precio_default);

  // Equipos for events like HollyFest
  const [equipos, setEquipos] = useState<any[]>([]);

  // Conferencistas tab state (shared with cortesía mode)
  const [confNombre, setConfNombre] = useState('');
  const [confTelefono, setConfTelefono] = useState('');
  const [confCorreo, setConfCorreo] = useState('');
  const [confSelectedSeat, setConfSelectedSeat] = useState<string | null>(null);
  const [cortesiaMode, setCortesiaMode] = useState(false);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    const [nacionesRes, equiposRes, asientosRes, registrosRes] = await Promise.all([
      supabase.from('naciones').select('*').order('nombre'),
      supabase.from('equipos_evento').select('*').eq('evento_id', evento.id).order('nombre'),
      evento.tiene_asientos
        ? supabase.from('asientos').select('*').eq('evento_id', evento.id)
        : Promise.resolve({ data: [] }),
      supabase.from('registros').select(`
        *,
        nacion:naciones(*),
        equipo:equipos_evento(*),
        asientos(*),
        pagos(*)
      `).eq('evento_id', evento.id).order('created_at', { ascending: false }),
    ]);

    if (nacionesRes.data) setNaciones(nacionesRes.data);
    if (equiposRes.data) setEquipos(equiposRes.data);
    if (asientosRes.data) setAsientos(asientosRes.data as Asiento[]);
    if (registrosRes.data) setRegistros(registrosRes.data);
  }, [evento.id, evento.tiene_asientos]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`event-${evento.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asientos' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, evento.id]);

  const resetForm = () => {
    setNombre(''); setEdad(''); setTelefono(''); setCorreo(''); setWhatsapp(''); setNacionId(''); setEquipoId('');
    setNumBoletos(1); setGuestNames([]); setSelectedSeats([]); setMontoPago(''); setMetodoPago('efectivo'); setMetodosPorBoleto([]); setSplitPayment(false); setSplitMontos([{ metodo: 'efectivo', monto: '' }, { metodo: 'tarjeta', monto: '' }]); setTipo('Encuentrista');
    setCortesiaMode(false); setConfNombre(''); setConfTelefono(''); setConfCorreo(''); setConfSelectedSeat(null);
  };

  // Computed: total based on number of boletos
  const montoTotal = precioBoleto * numBoletos;
  const splitTotal = splitPayment ? splitMontos.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0) : 0;
  const montoAbono = splitPayment ? splitTotal : (parseFloat(montoPago) || 0);
  const willBeLiquidado = isFreeEvent || montoAbono >= montoTotal;
  const hasEquipos = equipos.length > 0;

  const handleSeatClick = (seatId: string) => {
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) return prev.filter(s => s !== seatId);
      if (prev.length >= numBoletos) return [...prev.slice(1), seatId]; // Replace oldest if at limit
      return [...prev, seatId];
    });
  };

  const handleSubmit = async () => {
    if (!nombre.trim()) { addToast('error', 'El nombre es requerido'); return; }
    if (!hasEquipos && !nacionId) { addToast('error', 'Selecciona una nación'); return; }
    if (hasEquipos && !equipoId) { addToast('error', 'Selecciona un equipo'); return; }
    if (!isFreeEvent && montoAbono > montoTotal) { addToast('error', 'El abono no puede ser mayor al total'); return; }

    if (willBeLiquidado && evento.tiene_asientos) {
      if (selectedSeats.length !== numBoletos) {
        addToast('error', `Selecciona ${numBoletos} asiento${numBoletos > 1 ? 's' : ''} en el mapa (tienes ${selectedSeats.length})`);
        return;
      }
    }

    setLoading(true);
    try {
      if (isFreeEvent) {
        // Free event — single registration, no payment
        const { data: registro, error: regError } = await supabase
          .from('registros')
          .insert({
            nombre: nombre.trim(), telefono: telefono.trim() || null, correo: correo.trim() || null,
            whatsapp: whatsapp.trim() || null, edad: edad ? parseInt(edad) : null,
            nacion_id: hasEquipos ? null : nacionId, equipo_id: hasEquipos ? equipoId : null,
            evento_id: evento.id, tipo: 'general', status: 'liquidado',
            monto_total: 0, monto_pagado: 0, precio_boleto: 0,
          })
          .select().single();
        if (regError) throw regError;

        if (user) {
          await logActivity({ userId: user.id, userName: user.nombre, action: 'registro_creado', detail: `${nombre.trim()} (gratuito)`, eventoId: evento.id, registroId: registro.id });
        }

        addToast('success', `${nombre} registrado en ${evento.nombre}`);
        resetForm();
        fetchData();
        return;
      }

      // Paid event — existing multi-boleto logic
      const basePerBoleto = Math.floor(montoAbono / numBoletos);
      const remainder = montoAbono - (basePerBoleto * numBoletos);
      // First boleto gets the extra cents/pesos
      const pagos: number[] = Array(numBoletos).fill(basePerBoleto);
      pagos[0] += remainder;

      // Build names for each boleto
      const boletoNames: string[] = [];
      boletoNames.push(nombre.trim());
      for (let i = 1; i < numBoletos; i++) {
        const guestName = guestNames[i - 1]?.trim();
        if (guestName) {
          boletoNames.push(guestName);
        } else {
          boletoNames.push(`${nombre.trim()} - Invitada ${i}`);
        }
      }

      const createdIds: string[] = [];

      // Create one registro per boleto
      for (let i = 0; i < numBoletos; i++) {
        const pagoBoleto = pagos[i];
        const statusBoleto = pagoBoleto >= precioBoleto ? 'liquidado' : pagoBoleto > 0 ? 'abono' : 'pendiente';

        const { data: registro, error: regError } = await supabase
          .from('registros')
          .insert({
            nombre: boletoNames[i], telefono: i === 0 ? (telefono.trim() || null) : null,
            correo: i === 0 ? (correo.trim() || null) : null,
            whatsapp: i === 0 ? (whatsapp.trim() || null) : null,
            edad: i === 0 && edad ? parseInt(edad) : null,
            nacion_id: hasEquipos ? null : (nacionId || null),
            equipo_id: hasEquipos ? (equipoId || null) : null,
            evento_id: evento.id, tipo, status: statusBoleto,
            monto_total: precioBoleto, monto_pagado: pagoBoleto, precio_boleto: precioBoleto,
            notas: numBoletos > 1 ? `Grupo de ${nombre.trim()} (${numBoletos} boletos)` : null,
          })
          .select().single();
        if (regError) throw regError;
        createdIds.push(registro.id);

        // Assign seat if liquidado and seats available
        if (statusBoleto === 'liquidado' && evento.tiene_asientos && selectedSeats[i]) {
          const { error: seatError } = await supabase
            .from('asientos').update({ estado: 'ocupado', registro_id: registro.id }).eq('id', selectedSeats[i]);
          if (seatError) throw seatError;
        }

        // Record payments
        if (splitPayment) {
          // Split payment: distribute each split entry proportionally across boletos
          for (const sp of splitMontos) {
            const spMonto = parseFloat(sp.monto) || 0;
            if (spMonto <= 0) continue;
            const perBoleto = Math.floor(spMonto / numBoletos);
            const remainder = spMonto - (perBoleto * numBoletos);
            const share = i === 0 ? perBoleto + remainder : perBoleto;
            if (share > 0) {
              await supabase.from('pagos').insert({ registro_id: registro.id, monto: share, metodo_pago: sp.metodo });
            }
          }
        } else if (pagoBoleto > 0) {
          await supabase.from('pagos').insert({ registro_id: registro.id, monto: pagoBoleto, metodo_pago: metodoPago });
        }
      }

      // Send email for first registro, include all grupo IDs if multiple
      if (correo.trim() && createdIds.length > 0) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registroId: createdIds[0], grupoIds: createdIds.length > 1 ? createdIds : undefined }),
          });
        } catch {}
      }

      let msg = `${numBoletos} boleto${numBoletos > 1 ? 's' : ''} registrado${numBoletos > 1 ? 's' : ''} para ${nombre}. `;
      const allLiquidados = pagos.every(p => p >= precioBoleto);
      const anyAbono = pagos.some(p => p > 0 && p < precioBoleto);
      if (allLiquidados && selectedSeats.length > 0) {
        msg += `¡Liquidado${numBoletos > 1 ? 's' : ''}! Asientos: ${selectedSeats.join(', ')}`;
      } else if (allLiquidados) {
        msg += `¡Liquidado${numBoletos > 1 ? 's' : ''}!`;
      } else if (anyAbono) {
        msg += `Abono de $${montoAbono.toLocaleString()} distribuido en ${numBoletos} boletos.`;
      } else {
        msg += 'Pendiente de pago.';
      }

      // Log activity
      if (user) {
        const detail = `${numBoletos} boleto(s) para ${nombre.trim()}${montoAbono > 0 ? ` — $${montoAbono.toLocaleString()} ${metodoPago}` : ''}${selectedSeats.length > 0 ? ` — Asientos: ${selectedSeats.join(', ')}` : ''}`;
        await logActivity({ userId: user.id, userName: user.nombre, action: 'registro_creado', detail, eventoId: evento.id, registroId: createdIds[0] });
        if (montoAbono > 0) {
          await logActivity({ userId: user.id, userName: user.nombre, action: 'pago_registrado', detail: `$${montoAbono.toLocaleString()} ${metodoPago} — ${nombre.trim()}`, eventoId: evento.id, registroId: createdIds[0] });
        }
      }
      addToast('success', msg);
      resetForm();
      fetchData();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOccupiedSeatClick = (seat: Asiento) => {
    if (!seat.registro_id) return;
    const reg = registros.find(r => r.id === seat.registro_id);
    if (reg) {
      setSelectedRegistro(reg);
      setTab('registros');
    }
  };

  // Computed: separate conferencistas from regular registros
  const regularRegistros = registros.filter(r => (r as any).tipo !== 'conferencista');
  const confRegistros = registros.filter(r => (r as any).tipo === 'conferencista');
  const hasConfSeats = asientos.some(a => a.seccion === 'conferencistas');

  const handleRegistroConferencista = async () => {
    if (!confNombre.trim()) { addToast('error', 'El nombre es requerido'); return; }
    if (!confSelectedSeat) { addToast('error', 'Selecciona un asiento RE en el mapa'); return; }
    setLoading(true);
    try {
      const { data: reg, error: regError } = await supabase
        .from('registros')
        .insert({
          nombre: confNombre.trim(),
          telefono: confTelefono.trim() || null,
          correo: confCorreo.trim() || null,
          evento_id: evento.id,
          tipo: 'conferencista',
          monto_total: 0,
          monto_pagado: 0,
          status: 'liquidado',
        })
        .select()
        .single();
      if (regError) throw regError;
      const { error: seatError } = await supabase
        .from('asientos')
        .update({ estado: 'ocupado', registro_id: reg.id })
        .eq('id', confSelectedSeat);
      if (seatError) throw seatError;
      const seat = asientos.find(a => a.id === confSelectedSeat);
      addToast('success', `${confNombre.trim()} → ${seatLabel(seat ?? { fila: 'RE', columna: 0 })}`);
      if (user) {
        await logActivity({ userId: user.id, userName: user.nombre, action: 'asiento_asignado',
          detail: `${confNombre.trim()} (conferencista) → ${seatLabel(seat ?? { fila: 'RE', columna: 0 })}`,
          eventoId: evento.id });
      }
      if (confCorreo.trim()) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registroId: reg.id, isCortesia: true }),
          });
        } catch {} // non-critical
      }
      setConfNombre(''); setConfTelefono(''); setConfCorreo(''); setConfSelectedSeat(null);
      fetchData();
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    } finally {
      setLoading(false); }
  };

  const BlurValue = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <span className={className} style={privacyMode ? { filter: 'blur(8px)', userSelect: 'none' } : {}}>{children}</span>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = theme.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}>
              ← {userRole === 'evento' ? 'Cerrar sesión' : 'Eventos'}
            </button>
            <div>
              {availableEventos && availableEventos.length > 1 && onEventChange ? (
                <div className="flex items-center gap-2">
                  <select
                    value={evento.id}
                    onChange={e => {
                      const next = availableEventos.find(ev => ev.id === e.target.value);
                      if (next) onEventChange(next);
                    }}
                    className="font-bold text-lg rounded-lg px-2 py-1 border bg-transparent cursor-pointer"
                    style={{ fontFamily: 'var(--font-display)', borderColor: theme.border, color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                    {availableEventos.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.nombre}</option>
                    ))}
                  </select>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{evento.nombre}</h1>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
            {canRegister && (
              <button onClick={() => { setTab('nuevo'); setSelectedRegistro(null); }}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'nuevo' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === 'nuevo' ? { background: 'var(--color-accent)' } : {}}>
                + Nuevo
              </button>
            )}
            {canSeeRegistros && (
              <button onClick={() => { setTab('registros'); setSelectedRegistro(null); }}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'registros' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === 'registros' ? { background: 'var(--color-accent)' } : {}}>
                {userRole === 'dueno' ? '📋 Asistentes' : 'Registros'} ({regularRegistros.length})
              </button>
            )}
            {canSeeDashboard && (
              <button onClick={() => { setTab('dashboard'); setSelectedRegistro(null); }}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'dashboard' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === 'dashboard' ? { background: 'var(--color-accent)' } : {}}>
                📊 Dashboard
              </button>
            )}
            {userRole === 'admin' && evento.tiene_asientos && hasConfSeats && (
              <button onClick={() => { setTab('conferencistas'); setSelectedRegistro(null); }}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'conferencistas' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === 'conferencistas' ? { background: '#d97706' } : {}}>
                ⭐ Conf. ({confRegistros.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-5">
            {(userRole === 'admin' || userRole === 'registro') && (
              <button onClick={() => setShowCorteDeCaja(true)}
                className="text-sm px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = theme.accent)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}>
                📊 Corte
              </button>
            )}
            {userRole !== 'registro' && userRole !== 'evento' && (
              <button onClick={() => setPrivacyMode(!privacyMode)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all"
                style={{ borderColor: privacyMode ? 'var(--color-accent)' : 'var(--color-border)', background: privacyMode ? 'rgba(0,188,212,0.1)' : 'transparent', color: privacyMode ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                {privacyMode ? '👁️‍🗨️ Oculto' : '👁️ Visible'}
              </button>
            )}
            {userRole !== 'evento' && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>{regularRegistros.length}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>Registros</div>
              </div>
              {!isFreeEvent && userRole !== 'registro' && (
                <div className="text-center">
                  <BlurValue className="font-bold text-lg text-amber-400 block">
                    ${regularRegistros.reduce((s, r) => s + Number(r.monto_pagado), 0).toLocaleString()}
                  </BlurValue>
                  <div style={{ color: 'var(--color-text-muted)' }}>Recaudado</div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {tab === 'nuevo' && (
          <div className={`grid grid-cols-1 ${evento.tiene_asientos ? 'xl:grid-cols-[1fr_420px]' : 'max-w-xl mx-auto'} gap-6`}>
            {/* Seat map — always visible, interactive only when liquidando or cortesía */}
            {evento.tiene_asientos && (
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: cortesiaMode ? 'rgba(245,158,11,0.4)' : 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: cortesiaMode ? '#f59e0b' : undefined }}>
                    {cortesiaMode ? '⭐ Selecciona asiento RE' : willBeLiquidado ? `Selecciona ${numBoletos} Asiento${numBoletos > 1 ? 's' : ''}` : 'Mapa de Asientos'}
                  </h2>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600/40 border border-emerald-700/50"></span>Disponible</span>
                    {(willBeLiquidado || cortesiaMode) && (
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-cyan-500" style={{ background: 'var(--color-accent)' }}></span>Seleccionado</span>
                    )}
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-600/30 border border-cyan-600/50"></span>Ocupado</span>
                  </div>
                </div>
                {cortesiaMode && confSelectedSeat && (() => {
                  const seat = asientos.find(a => a.id === confSelectedSeat);
                  return (
                    <div className="rounded-lg p-3 mb-4 text-sm font-medium flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                      ✓ Asiento seleccionado: <strong>{seat ? seatLabel(seat) : '—'}</strong>
                    </div>
                  );
                })()}
                {cortesiaMode && !confSelectedSeat && (
                  <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    ⭐ Expande la sección Conferencistas y selecciona un asiento RE
                  </div>
                )}
                {!cortesiaMode && willBeLiquidado && selectedSeats.length > 0 && (
                  <div className="rounded-lg p-3 mb-4 text-sm font-medium flex items-center gap-2" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.2)', color: 'var(--color-accent)' }}>
                    ✓ {selectedSeats.length}/{numBoletos} seleccionado{selectedSeats.length > 1 ? 's' : ''}: {selectedSeats.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{s}</span>
                    ))}
                  </div>
                )}
                {!cortesiaMode && !willBeLiquidado && (
                  <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    👀 Vista de referencia — Liquida el boleto para seleccionar asiento.
                  </div>
                )}
                {cortesiaMode ? (
                  <SeatMap asientos={asientos}
                    selectedSeats={confSelectedSeat ? [confSelectedSeat] : []}
                    onSeatClick={id => setConfSelectedSeat(prev => prev === id ? null : id)}
                    onOccupiedClick={handleOccupiedSeatClick}
                    readOnly={true}
                    allowSelectConferencistas={true} />
                ) : (
                  <SeatMap asientos={asientos} selectedSeats={willBeLiquidado ? selectedSeats : []}
                    onSeatClick={willBeLiquidado ? handleSeatClick : () => {}} onOccupiedClick={handleOccupiedSeatClick} readOnly={!willBeLiquidado} />
                )}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: cortesiaMode ? 'rgba(245,158,11,0.4)' : 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {cortesiaMode ? '⭐ Registro Cortesía' : 'Datos del Registro'}
                  </h2>
                  {hasConfSeats && (
                    <button onClick={() => { setCortesiaMode(v => !v); setConfSelectedSeat(null); setSelectedSeats([]); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      style={cortesiaMode
                        ? { borderColor: 'rgba(245,158,11,0.6)', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }
                        : { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      ⭐ Cortesía
                    </button>
                  )}
                </div>

                {/* Cortesía mode form */}
                {cortesiaMode && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre *</label>
                      <input type="text" value={confNombre} onChange={e => setConfNombre(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Teléfono (opcional)</label>
                      <input type="tel" value={confTelefono} onChange={e => setConfTelefono(e.target.value)}
                        placeholder="10 dígitos"
                        className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Correo (opcional)</label>
                      <input type="email" value={confCorreo} onChange={e => setConfCorreo(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <button onClick={handleRegistroConferencista}
                      disabled={loading || !confNombre.trim() || !confSelectedSeat}
                      className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', fontFamily: 'var(--font-display)' }}>
                      {loading ? 'Registrando...' : confSelectedSeat ? `Registrar en ${seatLabel(asientos.find(a => a.id === confSelectedSeat) ?? { fila: '', columna: 0 })}` : 'Selecciona un asiento RE'}
                    </button>
                  </div>
                )}

                {/* Normal form */}
                {!cortesiaMode && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nombre completo *</label>
                    <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la persona"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  {/* Edad — for events with equipos (campamento style) */}
                  {hasEquipos && !isFreeEvent && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Edad</label>
                      <input type="number" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Ej: 17"
                        className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                  )}
                  {evento.slug?.toLowerCase().includes('encuentro') && !isFreeEvent && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Tipo</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Encuentrista', 'Servidor'].map(t => (
                          <button key={t} onClick={() => { setTipo(t); setPrecioBoleto(t === 'Servidor' ? 150 : evento.precio_default); }}
                            className={`px-3 py-2 rounded-lg text-sm border transition-all ${tipo === t ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                            style={tipo === t ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                            {t === 'Servidor' ? '⭐ Servidor ($150)' : `👤 ${t} ($${evento.precio_default})`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isFreeEvent && (<>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Número de boletos</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => {
                        const n = Math.max(1, numBoletos - 1);
                        setNumBoletos(n);
                        setSelectedSeats(prev => prev.slice(0, n));
                        setGuestNames(prev => prev.slice(0, Math.max(0, n - 1)));
                      }}
                        className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center hover:border-cyan-500 transition-all"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>−</button>
                      <span className="text-2xl font-bold w-10 text-center" style={{ fontFamily: 'var(--font-display)' }}>{numBoletos}</span>
                      <button onClick={() => setNumBoletos(numBoletos + 1)}
                        className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center hover:border-cyan-500 transition-all"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>+</button>
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        × ${precioBoleto.toLocaleString()} = <strong style={{ color: 'var(--color-text)' }}>${montoTotal.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                  {/* Guest names for additional boletos */}
                  {numBoletos > 1 && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        Nombres de los boletos <span className="opacity-50">(opcional — si no pones nombre se guarda como "Invitada 1", etc.)</span>
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--color-accent)' }}>1</span>
                          <span className="font-medium">{nombre || 'Titular'}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>(titular)</span>
                        </div>
                        {Array.from({ length: numBoletos - 1 }, (_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{i + 2}</span>
                            <input
                              type="text"
                              value={guestNames[i] || ''}
                              onChange={e => {
                                const newNames = [...guestNames];
                                newNames[i] = e.target.value;
                                setGuestNames(newNames);
                              }}
                              placeholder={`${nombre || 'Titular'} - Invitada ${i + 1}`}
                              className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent"
                              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>)}
                  {/* Equipo/Escuadrón selector */}
                  {hasEquipos && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        {isFreeEvent ? 'Equipo *' : 'Escuadrón *'}
                      </label>
                      {(() => {
                        const generos = Array.from(new Set(equipos.map(e => e.genero).filter(Boolean)));
                        const hasGeneros = generos.length > 0;
                        return (
                          <div className="space-y-3">
                            {hasGeneros ? generos.map(g => (
                              <div key={g}>
                                <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                  {g === 'mujeres' ? '👩 Mujeres' : '👨 Hombres'}
                                </div>
                                <div className="space-y-1.5">
                                  {equipos.filter(eq => eq.genero === g).map(eq => (
                                    <button key={eq.id} onClick={() => setEquipoId(eq.id)}
                                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all ${equipoId === eq.id ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                                      style={equipoId === eq.id ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                                      <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: eq.color }} />
                                        <span className="font-medium">{eq.nombre}</span>
                                      </div>
                                      {(eq.lider || eq.consejero) && (
                                        <div className="text-[10px] mt-0.5 ml-5" style={{ color: 'var(--color-text-muted)' }}>
                                          {eq.lider && `Líder: ${eq.lider}`}{eq.lider && eq.consejero && ' · '}{eq.consejero && `Consejero: ${eq.consejero}`}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )) : (
                              <div className="space-y-1.5">
                                {equipos.map(eq => (
                                  <button key={eq.id} onClick={() => setEquipoId(eq.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all flex items-center gap-3 ${equipoId === eq.id ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                                    style={equipoId === eq.id ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: eq.color }} />
                                    {eq.nombre}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Nación — for events that use naciones (paid without equipos, or paid with equipos that also need nación) */}
                  {(!hasEquipos || (hasEquipos && !isFreeEvent)) && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nación {!hasEquipos ? '*' : ''}</label>
                      <select value={nacionId} onChange={e => setNacionId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                        <option value="">Seleccionar nación...</option>
                        {naciones.map(n => (<option key={n.id} value={n.id}>{n.nombre}</option>))}
                      </select>
                    </div>
                  )}
                  {/* Teléfono / WhatsApp */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Teléfono / WhatsApp</label>
                    <input type="tel" value={telefono} onChange={e => { setTelefono(e.target.value); setWhatsapp(e.target.value); }} placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  {/* Correo */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Correo</label>
                    <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                </div>
                )}

              </div>

              {!cortesiaMode && !isFreeEvent && (
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Pago</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Total ({numBoletos} boleto{numBoletos > 1 ? 's' : ''} × ${precioBoleto.toLocaleString()})
                    </span>
                    <span className="text-xl font-bold">${montoTotal.toLocaleString()}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Método de pago</label>
                    {!splitPayment ? (
                      <div className="grid grid-cols-2 gap-2">
                        {METODOS_PAGO.map(m => (
                          <button key={m.value} onClick={() => setMetodoPago(m.value as MetodoPago)}
                            className={`px-3 py-2 rounded-lg text-sm border transition-all ${metodoPago === m.value ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                            style={metodoPago === m.value ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {splitMontos.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <select value={s.metodo} onChange={e => {
                              const updated = [...splitMontos];
                              updated[i] = { ...updated[i], metodo: e.target.value as MetodoPago };
                              setSplitMontos(updated);
                            }} className="px-2 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                              {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                              <input type="number" value={s.monto} onChange={e => {
                                const updated = [...splitMontos];
                                updated[i] = { ...updated[i], monto: e.target.value };
                                setSplitMontos(updated);
                              }} placeholder="Monto" className="w-full pl-7 pr-3 py-2 rounded-lg text-sm border bg-transparent"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                            </div>
                            {splitMontos.length > 2 && (
                              <button onClick={() => setSplitMontos(splitMontos.filter((_, idx) => idx !== i))}
                                className="text-xs px-2 py-2 rounded hover:text-red-400" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between">
                          <button onClick={() => setSplitMontos([...splitMontos, { metodo: 'transferencia', monto: '' }])}
                            className="text-xs underline" style={{ color: 'var(--color-accent)' }}>+ Agregar método</button>
                          <span className="text-xs" style={{ color: splitMontos.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0) === montoTotal ? '#10b981' : 'var(--color-text-muted)' }}>
                            Total: ${splitMontos.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0).toLocaleString()} / ${montoTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                    <button onClick={() => {
                      setSplitPayment(!splitPayment);
                      if (!splitPayment) {
                        setSplitMontos([{ metodo: 'efectivo', monto: '' }, { metodo: 'tarjeta', monto: '' }]);
                      }
                    }} className="text-xs mt-2 underline" style={{ color: 'var(--color-text-muted)' }}>
                      {splitPayment ? 'Un solo método de pago' : 'Dividir pago en varios métodos'}
                    </button>
                  </div>
                  {!splitPayment && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Monto a pagar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                      <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} placeholder={montoTotal.toString()}
                        className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <button onClick={() => setMontoPago(montoTotal.toString())} className="text-xs underline mt-1" style={{ color: 'var(--color-accent)' }}>Pagar total</button>
                  </div>
                  )}

                  {/* Hint: seat map will appear when liquidando */}
                  {evento.tiene_asientos && !willBeLiquidado && montoAbono > 0 && (
                    <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                      💡 El asiento se asigna al liquidar el boleto. Completa el pago total para seleccionar lugar.
                    </div>
                  )}

                  <button onClick={handleSubmit}
                    disabled={loading || !nombre.trim() || (!hasEquipos && !nacionId) || (hasEquipos && !equipoId)}
                    className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40 glow-pulse"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                    {loading ? 'Procesando...' : willBeLiquidado && evento.tiene_asientos ? 'Liquidar y Asignar Asiento' : 'Registrar'}
                  </button>
                </div>
              </div>
              )}

              {/* Submit button for free events (outside payment card) */}
              {!cortesiaMode && isFreeEvent && (
                <button onClick={handleSubmit}
                  disabled={loading || !nombre.trim() || (hasEquipos && !equipoId) || (!hasEquipos && !nacionId)}
                  className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40 glow-pulse"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                  {loading ? 'Procesando...' : 'Registrar'}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'registros' && !selectedRegistro && (
          <RegistrosList registros={regularRegistros} naciones={naciones} equipos={equipos}
            onSelect={userRole === 'dueno' ? () => {} : setSelectedRegistro}
            onRefresh={fetchData} privacyMode={privacyMode} showCheckIn={true} showCheckIn2={evento.slug?.toLowerCase().includes('encuentro')} eventoId={evento.id} addToast={addToast} userRole={userRole} isFreeEvent={isFreeEvent} readOnly={userRole === 'dueno'} />
        )}

        {tab === 'registros' && selectedRegistro && (
          <RegistroDetail registro={selectedRegistro} naciones={naciones} asientos={asientos}
            tieneAsientos={evento.tiene_asientos} allRegistros={regularRegistros} esEncuentro={evento.slug?.toLowerCase().includes('encuentro')}
            onBack={() => { setSelectedRegistro(null); fetchData(); }} onRefresh={fetchData} addToast={addToast} />
        )}

        {tab === 'dashboard' && (
          <Dashboard registros={regularRegistros} asientos={asientos} naciones={naciones} eventoFecha={evento.fecha} eventoNombre={evento.nombre} isFreeEvent={isFreeEvent} equipos={equipos} />
        )}

        {tab === 'conferencistas' && !selectedRegistro && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            {/* RE Seat Map */}
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'rgba(245,158,11,0.4)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: '#f59e0b' }}>
                ⭐ Asientos Conferencistas — RE-1 a RE-42
              </h2>
              <div className="flex gap-8 justify-center">
                {(['left', 'right'] as const).map(side => (
                  <div key={side} className="space-y-0.5">
                    {CONF_SEAT_ROWS.map((row, i) => (
                      <div key={i} className="flex gap-0.5">
                        {row[side].map(n => {
                          const seat = asientos.find(a => a.seccion === 'conferencistas' && a.columna === n);
                          const label = `RE-${n}`;
                          const isSelected = confSelectedSeat === seat?.id;
                          const isOcupado = seat?.estado === 'ocupado';
                          const ocupante = isOcupado ? confRegistros.find(r => r.id === seat?.registro_id) : null;
                          let cls = 'seat';
                          if (isSelected) cls += ' seat-selected';
                          else if (isOcupado) cls += ' seat-ocupado';
                          else if (seat) cls += ' seat-disponible';
                          return (
                            <button key={n} className={cls} style={{ width: 44, cursor: seat ? 'pointer' : 'default' }}
                              title={ocupante ? `${label} — ${ocupante.nombre}` : label}
                              onClick={() => {
                                if (!seat) return;
                                if (isOcupado) {
                                  const reg = registros.find(r => r.id === seat.registro_id);
                                  if (reg) { setSelectedRegistro(reg); }
                                } else {
                                  setConfSelectedSeat(isSelected ? null : seat.id);
                                }
                              }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-center text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
                Click en disponible para seleccionar · Click en ocupado para ver registro
              </p>
            </div>

            {/* Right column: form + list */}
            <div className="space-y-6">
              {/* Registration form */}
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Registrar Conferencista</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre *</label>
                    <input type="text" value={confNombre} onChange={e => setConfNombre(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Teléfono (opcional)</label>
                    <input type="tel" value={confTelefono} onChange={e => setConfTelefono(e.target.value)}
                      placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Correo (opcional)</label>
                    <input type="email" value={confCorreo} onChange={e => setConfCorreo(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  {confSelectedSeat && (() => {
                    const seat = asientos.find(a => a.id === confSelectedSeat);
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                        ✓ Asiento seleccionado: <strong>{seat ? seatLabel(seat) : '—'}</strong>
                        <button onClick={() => setConfSelectedSeat(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
                      </div>
                    );
                  })()}
                  {!confSelectedSeat && (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Selecciona un asiento en el mapa</p>
                  )}
                  <button onClick={handleRegistroConferencista} disabled={loading || !confNombre.trim() || !confSelectedSeat}
                    className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', fontFamily: 'var(--font-display)' }}>
                    {loading ? 'Registrando...' : 'Registrar sin pago'}
                  </button>
                </div>
              </div>

              {/* List of conferencistas */}
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Registradas ({confRegistros.length}/42)
                </h3>
                {confRegistros.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin conferencistas registradas aún</p>
                ) : (
                  <div className="space-y-1">
                    {confRegistros.map(r => {
                      const rAsientos = (r.asientos || []) as any[];
                      return (
                        <button key={r.id} onClick={() => setSelectedRegistro(r)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-left transition-colors"
                          style={{ background: 'var(--color-bg)' }}>
                          <span className="font-medium">{r.nombre}</span>
                          {rAsientos.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: '#d97706' }}>
                              {seatLabel(rAsientos[0])}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'conferencistas' && selectedRegistro && (
          <RegistroDetail registro={selectedRegistro} naciones={naciones} asientos={asientos}
            tieneAsientos={evento.tiene_asientos} allRegistros={regularRegistros} esEncuentro={evento.slug?.toLowerCase().includes('encuentro')}
            onBack={() => { setSelectedRegistro(null); fetchData(); }} onRefresh={fetchData} addToast={addToast} />
        )}
      </main>

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} type={t.type} message={t.message} />)}
      </div>

      {showCorteDeCaja && <CorteDeCajaModal onClose={() => setShowCorteDeCaja(false)} />}
    </div>
  );
}
