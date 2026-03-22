'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { METODOS_PAGO } from '@/lib/constants';
import { applyTheme, getTheme, resetTheme } from '@/lib/themes';
import { logActivity } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import type { Nacion, Registro, Asiento, MetodoPago } from '@/types';
import SeatMap from '@/components/SeatMap';
import RegistrosList from '@/components/RegistrosList';
import RegistroDetail from '@/components/RegistroDetail';
import Dashboard from '@/components/Dashboard';
import Toast from '@/components/Toast';

type Tab = 'nuevo' | 'registros' | 'dashboard';

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

export default function EventHome({ evento, onBack, userRole = 'registro' }: { evento: Evento; onBack: () => void; userRole?: string }) {
  const theme = getTheme(evento.slug);
  const isFreeEvent = evento.precio_default === 0;
  const canRegister = userRole === 'admin' || userRole === 'registro' || userRole === 'evento';
  const canSeeDashboard = userRole === 'admin' || userRole === 'dueno';
  const canSeeRegistros = canRegister && userRole !== 'evento'; // evento role only sees new registration
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
  const [precioBoleto, setPrecioBoleto] = useState(evento.precio_default);

  // Equipos for events like HollyFest
  const [equipos, setEquipos] = useState<any[]>([]);

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
    setNumBoletos(1); setGuestNames([]); setSelectedSeats([]); setMontoPago(''); setMetodoPago('efectivo'); setTipo('Encuentrista');
  };

  // Computed: total based on number of boletos
  const montoTotal = precioBoleto * numBoletos;
  const montoAbono = parseFloat(montoPago) || 0;
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

        // Record individual payment
        if (pagoBoleto > 0) {
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
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{evento.nombre}</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
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
                Registros ({registros.length})
              </button>
            )}
            {canSeeDashboard && (
              <button onClick={() => { setTab('dashboard'); setSelectedRegistro(null); }}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'dashboard' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === 'dashboard' ? { background: 'var(--color-accent)' } : {}}>
                📊 Dashboard
              </button>
            )}
          </div>

          <div className="flex items-center gap-5">
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
                <div className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>{registros.length}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>Registros</div>
              </div>
              {!isFreeEvent && userRole !== 'registro' && (
                <div className="text-center">
                  <BlurValue className="font-bold text-lg text-amber-400 block">
                    ${registros.reduce((s, r) => s + Number(r.monto_pagado), 0).toLocaleString()}
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
            {/* Seat map — always visible, interactive only when liquidando */}
            {evento.tiene_asientos && (
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {willBeLiquidado ? `Selecciona ${numBoletos} Asiento${numBoletos > 1 ? 's' : ''}` : 'Mapa de Asientos'}
                  </h2>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600/40 border border-emerald-700/50"></span>Disponible</span>
                    {willBeLiquidado && (
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-cyan-500" style={{ background: 'var(--color-accent)' }}></span>Seleccionado</span>
                    )}
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-600/30 border border-cyan-600/50"></span>Ocupado</span>
                  </div>
                </div>
                {willBeLiquidado && selectedSeats.length > 0 && (
                  <div className="rounded-lg p-3 mb-4 text-sm font-medium flex items-center gap-2" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.2)', color: 'var(--color-accent)' }}>
                    ✓ {selectedSeats.length}/{numBoletos} seleccionado{selectedSeats.length > 1 ? 's' : ''}: {selectedSeats.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{s}</span>
                    ))}
                  </div>
                )}
                {!willBeLiquidado && (
                  <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    👀 Vista de referencia — Liquida el boleto para seleccionar asiento.
                  </div>
                )}
                <SeatMap asientos={asientos} selectedSeats={willBeLiquidado ? selectedSeats : []}
                  onSeatClick={willBeLiquidado ? handleSeatClick : () => {}} readOnly={!willBeLiquidado} />
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Datos del Registro</h2>
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
                  {evento.slug === 'encuentro' && !isFreeEvent && (
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
                  {/* WhatsApp */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>WhatsApp</label>
                    <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  {/* Teléfono — only for events without equipos */}
                  {!hasEquipos && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Teléfono</label>
                      <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos"
                        className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                  )}
                  {/* Correo */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Correo</label>
                    <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                </div>
              </div>

              {!isFreeEvent && (
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
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Monto a pagar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                      <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} placeholder={montoTotal.toString()}
                        className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <button onClick={() => setMontoPago(montoTotal.toString())} className="text-xs underline mt-1" style={{ color: 'var(--color-accent)' }}>Pagar total</button>
                  </div>

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
              {isFreeEvent && (
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
          <RegistrosList registros={registros} naciones={naciones} onSelect={setSelectedRegistro}
            onRefresh={fetchData} privacyMode={privacyMode} showCheckIn={true} showCheckIn2={evento.slug === 'encuentro'} eventoId={evento.id} addToast={addToast} userRole={userRole} isFreeEvent={isFreeEvent} />
        )}

        {tab === 'registros' && selectedRegistro && (
          <RegistroDetail registro={selectedRegistro} naciones={naciones} asientos={asientos}
            tieneAsientos={evento.tiene_asientos} allRegistros={registros}
            onBack={() => { setSelectedRegistro(null); fetchData(); }} onRefresh={fetchData} addToast={addToast} />
        )}

        {tab === 'dashboard' && (
          <Dashboard registros={registros} asientos={asientos} naciones={naciones} eventoFecha={evento.fecha} eventoNombre={evento.nombre} isFreeEvent={isFreeEvent} equipos={equipos} />
        )}
      </main>

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} type={t.type} message={t.message} />)}
      </div>
    </div>
  );
}
