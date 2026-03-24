'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Asiento, Nacion } from '@/types';
import SeatMap from '@/components/SeatMap';
import Script from 'next/script';

interface Evento {
  id: string;
  nombre: string;
  slug: string;
  fecha: string;
  descripcion: string;
  precio_default: number;
  tiene_asientos: boolean;
  es_gratuito: boolean;
  usa_equipos: boolean;
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export default function ComprarPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [naciones, setNaciones] = useState<Nacion[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [mpReady, setMpReady] = useState(false);

  // Form
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [edad, setEdad] = useState('');
  const [nacionId, setNacionId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [numBoletos, setNumBoletos] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  // Step
  const [step, setStep] = useState<'eventos' | 'datos' | 'asientos' | 'pago'>('eventos');

  // MP widget container
  const walletContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('eventos').select('*').eq('activo', true).eq('es_gratuito', false).order('fecha')
      .then(({ data }) => { if (data) setEventos(data as Evento[]); setLoading(false); });
  }, []);

  const loadEventData = useCallback(async (evento: Evento) => {
    const [nRes, eqRes, aRes] = await Promise.all([
      supabase.from('naciones').select('*').order('nombre'),
      supabase.from('equipos_evento').select('*').eq('evento_id', evento.id).order('nombre'),
      evento.tiene_asientos
        ? supabase.from('asientos').select('*').eq('evento_id', evento.id)
        : Promise.resolve({ data: [] }),
    ]);
    if (nRes.data) setNaciones(nRes.data);
    if (eqRes.data) setEquipos(eqRes.data);
    if (aRes.data) setAsientos(aRes.data as Asiento[]);
  }, []);

  const handleSelectEvento = (evento: Evento) => {
    setSelectedEvento(evento);
    loadEventData(evento);
    setStep('datos');
  };

  const handleSeatClick = (seatId: string) => {
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) return prev.filter(s => s !== seatId);
      if (prev.length >= numBoletos) return [...prev.slice(1), seatId];
      return [...prev, seatId];
    });
  };

  const handleDatosNext = () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return; }
    if (!correo.trim()) { setError('El correo es requerido para enviarte tu comprobante'); return; }
    setError('');
    if (selectedEvento?.tiene_asientos) {
      setStep('asientos');
    } else {
      setStep('pago');
    }
  };

  const handleAsientosNext = () => {
    if (selectedSeats.length < numBoletos) {
      setError(`Selecciona ${numBoletos} asiento${numBoletos > 1 ? 's' : ''}`);
      return;
    }
    setError('');
    setStep('pago');
  };

  // Create preference and render MP wallet button
  const initMercadoPago = useCallback(async () => {
    if (!selectedEvento || !mpReady) return;
    setProcessing(true);
    setError('');

    try {
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventoId: selectedEvento.id,
          nombre: nombre.trim(),
          correo: correo.trim(),
          telefono: telefono.trim() || null,
          whatsapp: whatsapp.trim() || null,
          edad: edad || null,
          nacionId: nacionId || null,
          equipoId: equipoId || null,
          asientoIds: selectedSeats.length > 0 ? selectedSeats : null,
          cantidad: numBoletos,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Clear previous widget
      if (walletContainerRef.current) {
        walletContainerRef.current.innerHTML = '';
      }

      // Initialize MP Bricks
      const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'es-MX' });
      const bricksBuilder = mp.bricks();

      await bricksBuilder.create('wallet', 'wallet_container', {
        initialization: {
          preferenceId: data.preferenceId,
        },
      });

      setProcessing(false);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar el pago');
      setProcessing(false);
    }
  }, [selectedEvento, mpReady, nombre, correo, telefono, whatsapp, edad, nacionId, equipoId, selectedSeats, numBoletos]);

  // Init MP when entering pago step
  useEffect(() => {
    if (step === 'pago' && mpReady) {
      initMercadoPago();
    }
  }, [step, mpReady, initMercadoPago]);

  const total = (selectedEvento?.precio_default || 0) * numBoletos;
  const hasEquipos = equipos.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Load MP SDK */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        onLoad={() => setMpReady(true)}
      />

      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Compra de Boletos
          </h1>
          {selectedEvento && step !== 'eventos' && (
            <button onClick={() => { setStep('eventos'); setSelectedEvento(null); setSelectedSeats([]); setError(''); }}
              className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Cambiar evento
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {/* Step indicators */}
        {selectedEvento && (
          <div className="flex items-center gap-2 mb-8">
            {['Datos', selectedEvento.tiene_asientos ? 'Asientos' : null, 'Pago'].filter(Boolean).map((label, i) => {
              const steps = ['datos', selectedEvento.tiene_asientos ? 'asientos' : null, 'pago'].filter(Boolean) as string[];
              const currentIdx = steps.indexOf(step);
              const isActive = i <= currentIdx;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold`}
                    style={{ background: isActive ? 'var(--color-accent)' : 'var(--color-border)', color: isActive ? 'white' : 'var(--color-text-muted)' }}>
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium" style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{label}</span>
                  {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: isActive ? 'var(--color-accent)' : 'var(--color-border)' }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 0: Event selection */}
        {step === 'eventos' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              Selecciona un evento
            </h2>
            <div className="grid gap-4">
              {eventos.filter(e => !e.es_gratuito && e.precio_default > 0).map(e => {
                const fecha = new Date(e.fecha + 'T12:00:00');
                return (
                  <button key={e.id} onClick={() => handleSelectEvento(e)}
                    className="w-full text-left rounded-xl p-6 border transition-all hover:scale-[1.01] hover:shadow-lg"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>{e.nombre}</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {e.descripcion && ` — ${e.descripcion}`}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>${e.precio_default.toLocaleString()}</span>
                      {e.tiene_asientos && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,188,212,0.1)', color: 'var(--color-accent)' }}>Con asientos</span>}
                    </div>
                  </button>
                );
              })}
              {eventos.length === 0 && (
                <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>No hay eventos disponibles</p>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Datos */}
        {step === 'datos' && selectedEvento && (
          <div className="space-y-4">
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>{selectedEvento.nombre}</h2>
                <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>${selectedEvento.precio_default.toLocaleString()}/boleto</span>
              </div>
              <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(selectedEvento.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nombre completo *</label>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo"
                    className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Correo electrónico *</label>
                  <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com (aquí recibes tu comprobante)"
                    className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Teléfono</label>
                    <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>WhatsApp</label>
                    <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="10 dígitos"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                </div>
                {hasEquipos && equipos.some(e => e.genero) && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Edad</label>
                    <input type="number" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Tu edad"
                      className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nación</label>
                  <select value={nacionId} onChange={e => setNacionId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    <option value="">Seleccionar nación...</option>
                    {naciones.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                  </select>
                </div>
                {hasEquipos && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Escuadrón</label>
                    <div className="space-y-1.5">
                      {equipos.map(eq => (
                        <button key={eq.id} onClick={() => setEquipoId(eq.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all ${equipoId === eq.id ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                          style={equipoId === eq.id ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: eq.color }} />
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
                )}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Número de boletos</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNumBoletos(Math.max(1, numBoletos - 1))}
                      className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>−</button>
                    <span className="text-2xl font-bold w-10 text-center" style={{ fontFamily: 'var(--font-display)' }}>{numBoletos}</span>
                    <button onClick={() => setNumBoletos(numBoletos + 1)}
                      className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>+</button>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Total: <strong style={{ color: 'var(--color-text)' }}>${total.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="rounded-lg p-3 text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

            <button onClick={handleDatosNext}
              className="w-full py-3 rounded-lg font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
              {selectedEvento.tiene_asientos ? 'Seleccionar Asientos' : 'Ir a Pagar'}
            </button>
          </div>
        )}

        {/* Step 2: Asientos */}
        {step === 'asientos' && selectedEvento?.tiene_asientos && (
          <div className="space-y-4">
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Selecciona {numBoletos} asiento{numBoletos > 1 ? 's' : ''}
                </h2>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600/40 border border-emerald-700/50"></span>Disponible</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-cyan-500" style={{ background: 'var(--color-accent)' }}></span>Tu selección</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-600/30 border border-cyan-600/50"></span>Ocupado</span>
                </div>
              </div>
              {selectedSeats.length > 0 && (
                <div className="rounded-lg p-3 mb-4 text-sm font-medium flex items-center gap-2" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.2)', color: 'var(--color-accent)' }}>
                  {selectedSeats.length}/{numBoletos} seleccionado{selectedSeats.length > 1 ? 's' : ''}: {selectedSeats.map(id => {
                    const seat = asientos.find(a => a.id === id);
                    return <span key={id} className="px-2 py-0.5 rounded text-xs font-bold text-white ml-1" style={{ background: 'var(--color-accent)' }}>{seat ? `${seat.fila}${seat.columna}` : id}</span>;
                  })}
                </div>
              )}
              <SeatMap asientos={asientos} selectedSeats={selectedSeats} onSeatClick={handleSeatClick} />
            </div>

            {error && <div className="rounded-lg p-3 text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('datos'); setError(''); }}
                className="flex-1 py-3 rounded-lg font-bold border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>← Volver</button>
              <button onClick={handleAsientosNext}
                className="flex-1 py-3 rounded-lg font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
                Ir a Pagar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resumen + Pago con MP integrado */}
        {step === 'pago' && selectedEvento && (
          <div className="space-y-4">
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Resumen de tu compra</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Evento</span>
                  <span className="font-medium">{selectedEvento.nombre}</span>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Nombre</span>
                  <span className="font-medium">{nombre}</span>
                </div>
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Correo</span>
                  <span className="font-medium">{correo}</span>
                </div>
                {selectedSeats.length > 0 && (
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Asientos</span>
                    <span className="font-medium flex gap-1">{selectedSeats.map(id => {
                      const seat = asientos.find(a => a.id === id);
                      return <span key={id} className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{seat ? `${seat.fila}${seat.columna}` : id}</span>;
                    })}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Boletos</span>
                  <span className="font-medium">{numBoletos} × ${selectedEvento.precio_default.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* MP Wallet Button - renders inline */}
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Método de pago</h3>
              {processing && (
                <div className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  Preparando opciones de pago...
                </div>
              )}
              <div id="wallet_container" ref={walletContainerRef}></div>
            </div>

            {error && <div className="rounded-lg p-3 text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

            <button onClick={() => { setStep(selectedEvento.tiene_asientos ? 'asientos' : 'datos'); setError(''); }}
              className="w-full py-3 rounded-lg font-bold border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>← Volver</button>
          </div>
        )}
      </main>
    </div>
  );
}
