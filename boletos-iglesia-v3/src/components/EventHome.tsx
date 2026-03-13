'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { METODOS_PAGO } from '@/lib/constants';
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

export default function EventHome({ evento, onBack }: { evento: Evento; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('registros');
  const [naciones, setNaciones] = useState<Nacion[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [privacyMode, setPrivacyMode] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [nacionId, setNacionId] = useState('');
  const [tipo, setTipo] = useState('Encuentrista');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [precioBoleto, setPrecioBoleto] = useState(evento.precio_default);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    const [nacionesRes, asientosRes, registrosRes] = await Promise.all([
      supabase.from('naciones').select('*').order('nombre'),
      evento.tiene_asientos
        ? supabase.from('asientos').select('*').eq('evento_id', evento.id)
        : Promise.resolve({ data: [] }),
      supabase.from('registros').select(`
        *,
        nacion:naciones(*),
        asientos(*),
        pagos(*)
      `).eq('evento_id', evento.id).order('created_at', { ascending: false }),
    ]);

    if (nacionesRes.data) setNaciones(nacionesRes.data);
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
    setNombre(''); setTelefono(''); setCorreo(''); setNacionId('');
    setSelectedSeats([]); setMontoPago(''); setMetodoPago('efectivo');
    setTipo('Encuentrista');
  };

  const handleSubmit = async () => {
    if (!nombre.trim()) { addToast('error', 'El nombre es requerido'); return; }
    if (!nacionId) { addToast('error', 'Selecciona una nación'); return; }
    if (evento.tiene_asientos && selectedSeats.length === 0) { addToast('error', 'Selecciona al menos un asiento'); return; }

    const numBoletos = evento.tiene_asientos ? selectedSeats.length : 1;
    const montoTotal = numBoletos * precioBoleto;
    const montoAbono = parseFloat(montoPago) || 0;

    if (montoAbono > montoTotal) { addToast('error', 'El abono no puede ser mayor al total'); return; }

    setLoading(true);
    try {
      const status = montoAbono >= montoTotal ? 'liquidado' : montoAbono > 0 ? 'abono' : 'pendiente';

      const { data: registro, error: regError } = await supabase
        .from('registros')
        .insert({
          nombre: nombre.trim(), telefono: telefono.trim() || null, correo: correo.trim() || null,
          nacion_id: nacionId, evento_id: evento.id, tipo, status,
          monto_total: montoTotal, monto_pagado: montoAbono, precio_boleto: precioBoleto,
        })
        .select().single();
      if (regError) throw regError;

      if (evento.tiene_asientos && selectedSeats.length > 0) {
        const { error: seatError } = await supabase
          .from('asientos').update({ estado: 'ocupado', registro_id: registro.id }).in('id', selectedSeats);
        if (seatError) throw seatError;
      }

      if (montoAbono > 0) {
        await supabase.from('pagos').insert({ registro_id: registro.id, monto: montoAbono, metodo_pago: metodoPago });
      }

      if (correo.trim()) {
        try { await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registroId: registro.id }) }); } catch {}
      }

      addToast('success', `Registro creado para ${nombre}. ${status === 'liquidado' ? '¡Boleto liquidado!' : status === 'abono' ? 'Abono registrado.' : 'Pendiente de pago.'}`);
      resetForm();
      fetchData();
    } catch (error: any) {
      addToast('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (seatId: string) => {
    setSelectedSeats(prev => prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]);
  };

  const montoTotal = (evento.tiene_asientos ? selectedSeats.length : 1) * precioBoleto;
  const montoAbono = parseFloat(montoPago) || 0;
  const saldoRestante = Math.max(0, montoTotal - montoAbono);

  const BlurValue = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <span className={className} style={privacyMode ? { filter: 'blur(8px)', userSelect: 'none' } : {}}>{children}</span>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg border hover:border-cyan-500 transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Eventos
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{evento.nombre}</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
            <button onClick={() => { setTab('nuevo'); setSelectedRegistro(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'nuevo' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              style={tab === 'nuevo' ? { background: 'var(--color-accent)' } : {}}>
              + Nuevo
            </button>
            <button onClick={() => { setTab('registros'); setSelectedRegistro(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'registros' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              style={tab === 'registros' ? { background: 'var(--color-accent)' } : {}}>
              Registros ({registros.length})
            </button>
            <button onClick={() => { setTab('dashboard'); setSelectedRegistro(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'dashboard' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              style={tab === 'dashboard' ? { background: 'var(--color-accent)' } : {}}>
              📊 Dashboard
            </button>
          </div>

          <div className="flex items-center gap-5">
            <button onClick={() => setPrivacyMode(!privacyMode)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{ borderColor: privacyMode ? 'var(--color-accent)' : 'var(--color-border)', background: privacyMode ? 'rgba(0,188,212,0.1)' : 'transparent', color: privacyMode ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {privacyMode ? '👁️‍🗨️ Oculto' : '👁️ Visible'}
            </button>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>{registros.length}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>Registros</div>
              </div>
              <div className="text-center">
                <BlurValue className="font-bold text-lg text-amber-400 block">
                  ${registros.reduce((s, r) => s + Number(r.monto_pagado), 0).toLocaleString()}
                </BlurValue>
                <div style={{ color: 'var(--color-text-muted)' }}>Recaudado</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {tab === 'nuevo' && (
          <div className={`grid grid-cols-1 ${evento.tiene_asientos ? 'xl:grid-cols-[1fr_420px]' : 'max-w-xl mx-auto'} gap-6`}>
            {evento.tiene_asientos && (
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Mapa de Asientos</h2>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600/40 border border-emerald-700/50"></span>Disponible</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-cyan-500" style={{ background: 'var(--color-accent)' }}></span>Seleccionado</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-600/30 border border-cyan-600/50"></span>Ocupado</span>
                  </div>
                </div>
                <SeatMap asientos={asientos} selectedSeats={selectedSeats} onSeatClick={handleSeatClick} />
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Datos del Registro</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nombre completo *</label>
                    <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la persona"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
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
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nación *</label>
                    <select value={nacionId} onChange={e => setNacionId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                      <option value="">Seleccionar nación...</option>
                      {naciones.map(n => (<option key={n.id} value={n.id}>{n.nombre}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Teléfono</label>
                    <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Correo</label>
                    <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  {evento.tiene_asientos && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Asientos</label>
                      <div className="min-h-[40px] px-3 py-2 rounded-lg border flex flex-wrap gap-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                        {selectedSeats.length === 0 ? <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Selecciona en el mapa ←</span>
                          : selectedSeats.sort().map(s => (
                            <span key={s} className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>
                              {s}<button onClick={() => handleSeatClick(s)} className="ml-1 opacity-60 hover:opacity-100">×</button>
                            </span>))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Pago</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total</span>
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
                  <button onClick={handleSubmit}
                    disabled={loading || !nombre.trim() || !nacionId || (evento.tiene_asientos && selectedSeats.length === 0)}
                    className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40 glow-pulse"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                    {loading ? 'Procesando...' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'registros' && !selectedRegistro && (
          <RegistrosList registros={registros} naciones={naciones} onSelect={setSelectedRegistro}
            onRefresh={fetchData} privacyMode={privacyMode} showCheckIn={true} eventoId={evento.id} addToast={addToast} />
        )}

        {tab === 'registros' && selectedRegistro && (
          <RegistroDetail registro={selectedRegistro} naciones={naciones}
            onBack={() => { setSelectedRegistro(null); fetchData(); }} onRefresh={fetchData} addToast={addToast} />
        )}

        {tab === 'dashboard' && (
          <Dashboard registros={registros} asientos={asientos} naciones={naciones} eventoFecha={evento.fecha} eventoNombre={evento.nombre} />
        )}
      </main>

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} type={t.type} message={t.message} />)}
      </div>
    </div>
  );
}
