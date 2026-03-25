'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Asiento, Nacion } from '@/types';
import SeatMap from '@/components/SeatMap';
import Script from 'next/script';
import Image from 'next/image';

interface Evento {
  id: string; nombre: string; slug: string; fecha: string; descripcion: string;
  precio_default: number; tiene_asientos: boolean; es_gratuito: boolean; usa_equipos: boolean;
}

declare global { interface Window { MercadoPago: any; } }

// Event flyer images (add more as needed)
const EVENT_IMAGES: Record<string, string> = {
  'legacy-women': '/flyer-legacy-women.jpg',
};

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
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [edad, setEdad] = useState('');
  const [nacionId, setNacionId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [numBoletos, setNumBoletos] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [step, setStep] = useState<'eventos' | 'datos' | 'asientos' | 'pago'>('eventos');
  const walletRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('eventos').select('*').eq('activo', true).eq('es_gratuito', false).order('fecha')
      .then(({ data }) => { if (data) setEventos(data as Evento[]); setLoading(false); });
  }, []);

  const loadEventData = useCallback(async (ev: Evento) => {
    const [nR, eR, aR] = await Promise.all([
      supabase.from('naciones').select('*').order('nombre'),
      supabase.from('equipos_evento').select('*').eq('evento_id', ev.id).order('nombre'),
      ev.tiene_asientos ? supabase.from('asientos').select('*').eq('evento_id', ev.id) : Promise.resolve({ data: [] }),
    ]);
    if (nR.data) setNaciones(nR.data);
    if (eR.data) setEquipos(eR.data);
    if (aR.data) setAsientos(aR.data as Asiento[]);
  }, []);

  const selectEvento = (ev: Evento) => { setSelectedEvento(ev); loadEventData(ev); setStep('datos'); };
  const handleSeatClick = (id: string) => {
    setSelectedSeats(p => {
      if (p.includes(id)) return p.filter(s => s !== id);
      if (p.length >= numBoletos) return [...p.slice(1), id];
      return [...p, id];
    });
  };
  const nextFromDatos = () => {
    if (!nombre.trim()) { setError('Ingresa tu nombre'); return; }
    if (!correo.trim()) { setError('Ingresa tu correo para recibir el boleto'); return; }
    setError(''); setStep(selectedEvento?.tiene_asientos ? 'asientos' : 'pago');
  };
  const nextFromAsientos = () => {
    if (selectedSeats.length < numBoletos) { setError(`Selecciona ${numBoletos} asiento${numBoletos > 1 ? 's' : ''}`); return; }
    setError(''); setStep('pago');
  };
  const initMP = useCallback(async () => {
    if (!selectedEvento || !mpReady) return;
    setProcessing(true); setError('');
    try {
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId: selectedEvento.id, nombre: nombre.trim(), correo: correo.trim(),
          telefono: telefono.trim() || null, whatsapp: whatsapp.trim() || null, edad: edad || null,
          nacionId: nacionId || null, equipoId: equipoId || null,
          asientoIds: selectedSeats.length > 0 ? selectedSeats : null, cantidad: numBoletos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (walletRef.current) walletRef.current.innerHTML = '';
      const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'es-MX' });
      await mp.bricks().create('wallet', 'wallet_container', { initialization: { preferenceId: data.preferenceId } });
      setProcessing(false);
    } catch (err: any) { setError(err.message || 'Error al iniciar pago'); setProcessing(false); }
  }, [selectedEvento, mpReady, nombre, correo, telefono, whatsapp, edad, nacionId, equipoId, selectedSeats, numBoletos]);

  useEffect(() => { if (step === 'pago' && mpReady) initMP(); }, [step, mpReady, initMP]);

  const total = (selectedEvento?.precio_default || 0) * numBoletos;
  const hasEquipos = equipos.length > 0;
  const fmtDate = (f: string) => {
    const d = new Date(f + 'T12:00:00');
    return { day: d.getDate(), mon: d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase(),
      full: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) };
  };
  const seatLabel = (id: string) => { const s = asientos.find(a => a.id === id); return s ? `${s.fila}${s.columna}` : id; };

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" onLoad={() => setMpReady(true)} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Sora:wght@400;600;700;800&display=swap');
        .cp{min-height:100dvh;background:#0a0e1a;color:#e8eaf0;font-family:'Outfit',sans-serif;overflow-x:hidden}
        .cp *{box-sizing:border-box}
        .cp-hd{position:sticky;top:0;z-index:50;background:rgba(10,14,26,.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06);padding:12px 16px}
        .cp-hd-in{max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
        .cp-logo-img{height:32px;width:auto;filter:brightness(1)}
        .cp-bk{font-size:12px;color:rgba(255,255,255,.4);background:rgba(255,255,255,.06);border:none;padding:6px 12px;border-radius:20px;cursor:pointer}
        .cp-mn{max-width:480px;margin:0 auto;padding:16px}
        .cp-steps{display:flex;align-items:center;gap:4px;margin-bottom:20px}
        .cp-st{display:flex;align-items:center;gap:6px;flex:1}
        .cp-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;transition:.3s}
        .cp-dot.on{background:#00e5ff;color:#0a0e1a;box-shadow:0 0 12px rgba(0,229,255,.25)}
        .cp-dot.off{background:rgba(255,255,255,.06);color:rgba(255,255,255,.2)}
        .cp-ln{flex:1;height:2px;border-radius:1px}
        .cp-ln.on{background:#00e5ff}.cp-ln.off{background:rgba(255,255,255,.06)}

        /* Event cards with image */
        .cp-ev{position:relative;border-radius:16px;overflow:hidden;cursor:pointer;transition:.3s;margin-bottom:14px;border:1px solid rgba(255,255,255,.06)}
        .cp-ev:active{transform:scale(.98)}
        .cp-ev-img{width:100%;height:200px;object-fit:cover;display:block}
        .cp-ev-overlay{position:absolute;bottom:0;left:0;right:0;padding:16px;background:linear-gradient(transparent,rgba(0,0,0,.85))}
        .cp-ev-tt{font-family:'Sora',sans-serif;font-size:18px;font-weight:800;margin-bottom:2px}
        .cp-ev-ds{font-size:11px;color:rgba(255,255,255,.6);margin-bottom:6px}
        .cp-ev-ft{display:flex;align-items:center;gap:8px}
        .cp-ev-pr{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#00e5ff}
        .cp-ev-bg{font-size:9px;font-weight:600;padding:3px 8px;border-radius:10px;background:rgba(0,229,255,.15);color:#00e5ff}

        /* Event card without image */
        .cp-ec{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden;cursor:pointer;transition:.3s;margin-bottom:14px}
        .cp-ec:active{transform:scale(.98)}
        .cp-ec-in{display:flex;align-items:stretch}
        .cp-ec-dt{width:64px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,229,255,.06);border-right:1px solid rgba(0,229,255,.08);padding:12px 0}
        .cp-ec-dd{font-family:'Sora',sans-serif;font-size:24px;font-weight:800;color:#00e5ff;line-height:1}
        .cp-ec-dm{font-size:9px;font-weight:700;color:rgba(0,229,255,.6);letter-spacing:1px;margin-top:2px}
        .cp-ec-nf{flex:1;padding:14px;display:flex;flex-direction:column;justify-content:center}
        .cp-ec-tt{font-family:'Sora',sans-serif;font-size:15px;font-weight:700;line-height:1.2;margin-bottom:2px}
        .cp-ec-ds{font-size:11px;color:rgba(255,255,255,.3);margin-bottom:6px}
        .cp-ec-ft{display:flex;align-items:center;gap:8px}
        .cp-ec-pr{font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:#00e5ff}
        .cp-ec-ar{color:rgba(255,255,255,.12);font-size:18px;padding-right:12px;display:flex;align-items:center}

        .cp-cd{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:20px;margin-bottom:12px}
        .cp-ct{font-family:'Sora',sans-serif;font-size:16px;font-weight:700;margin-bottom:16px}
        .cp-fl{margin-bottom:14px}
        .cp-lb{display:block;font-size:11px;font-weight:500;color:rgba(255,255,255,.4);margin-bottom:5px;letter-spacing:.3px}
        .cp-in{width:100%;padding:12px 14px;border-radius:12px;font-size:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#e8eaf0;outline:none;font-family:'Outfit',sans-serif;transition:.2s}
        .cp-in:focus{border-color:rgba(0,229,255,.4);background:rgba(0,229,255,.03)}
        .cp-in::placeholder{color:rgba(255,255,255,.18)}
        select.cp-in{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}

        /* Fixed quantity selector */
        .cp-qty{display:flex;align-items:center;gap:12px;flex-wrap:nowrap}
        .cp-qb{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#e8eaf0;font-size:18px;font-weight:600;cursor:pointer;transition:.2s;flex-shrink:0}
        .cp-qb:active{background:rgba(0,229,255,.1);border-color:rgba(0,229,255,.3)}
        .cp-qn{font-family:'Sora',sans-serif;font-size:28px;font-weight:800;min-width:36px;text-align:center;flex-shrink:0}
        .cp-qt{font-size:13px;color:rgba(255,255,255,.35);white-space:nowrap}
        .cp-qt b{color:#00e5ff;font-weight:700}

        .cp-eq{width:100%;text-align:left;padding:12px 14px;border-radius:12px;margin-bottom:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);color:#e8eaf0;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:10px}
        .cp-eq.sel{border-color:#00e5ff;background:rgba(0,229,255,.05)}
        .cp-eq-d{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .cp-eq-i{flex:1}.cp-eq-n{font-size:13px;font-weight:600}
        .cp-eq-s{font-size:10px;color:rgba(255,255,255,.3);margin-top:1px}
        .cp-eq-c{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:10px;transition:.2s}
        .cp-eq.sel .cp-eq-c{background:#00e5ff;border-color:#00e5ff;color:#0a0e1a}
        .cp-gd{font-size:10px;font-weight:700;color:rgba(255,255,255,.25);letter-spacing:1.5px;text-transform:uppercase;margin:12px 0 6px}

        .cp-bp{width:100%;padding:14px;border-radius:14px;font-size:15px;font-weight:700;font-family:'Sora',sans-serif;border:none;cursor:pointer;transition:.2s;background:linear-gradient(135deg,#00e5ff,#00b8d4);color:#0a0e1a;box-shadow:0 4px 20px rgba(0,229,255,.2)}
        .cp-bp:active{transform:scale(.98)}.cp-bp:disabled{opacity:.4;cursor:not-allowed;transform:none}
        .cp-bs{width:100%;padding:12px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4)}

        .cp-sr{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px}
        .cp-sr:last-child{border:none}
        .cp-sl{color:rgba(255,255,255,.35)}.cp-sv{font-weight:600}
        .cp-stot{font-family:'Sora',sans-serif;font-size:24px;font-weight:800;color:#00e5ff}
        .cp-err{background:rgba(255,59,48,.08);border:1px solid rgba(255,59,48,.15);border-radius:12px;padding:10px 14px;font-size:12px;color:#ff6b6b;text-align:center;margin-bottom:12px}
        .cp-stitle{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;text-align:center;margin-bottom:20px}
        .cp-sb{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#00e5ff;color:#0a0e1a}
        .cp-sbar{position:sticky;bottom:0;z-index:40;background:rgba(10,14,26,.95);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.06);padding:12px 16px}
        .cp-sbar-in{max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px}
        .cp-sbar-seats{display:flex;gap:4px;flex-wrap:wrap}
        @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .cp-a{animation:fu .35s ease-out both}
        .cp-a1{animation-delay:.05s}.cp-a2{animation-delay:.1s}.cp-a3{animation-delay:.15s}
      `}</style>

      <div className="cp">
        <header className="cp-hd">
          <div className="cp-hd-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-rn.png" alt="RN México" className="cp-logo-img" />
            {selectedEvento && step !== 'eventos' && (
              <button className="cp-bk" onClick={() => { setStep('eventos'); setSelectedEvento(null); setSelectedSeats([]); setError(''); }}>← Eventos</button>
            )}
          </div>
        </header>

        <main className="cp-mn">
          {/* Steps */}
          {selectedEvento && step !== 'eventos' && (
            <div className="cp-steps cp-a">
              {['Datos', selectedEvento.tiene_asientos ? 'Asientos' : null, 'Pago'].filter(Boolean).map((l, i) => {
                const ss = ['datos', selectedEvento.tiene_asientos ? 'asientos' : null, 'pago'].filter(Boolean) as string[];
                const ci = ss.indexOf(step); const on = i <= ci;
                return (<div key={l} className="cp-st">
                  <div className={`cp-dot ${on ? 'on' : 'off'}`}>{i + 1}</div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: on ? '#e8eaf0' : 'rgba(255,255,255,.2)' }}>{l}</span>
                  {i < ss.length - 1 && <div className={`cp-ln ${on ? 'on' : 'off'}`} />}
                </div>);
              })}
            </div>
          )}

          {/* EVENTOS */}
          {step === 'eventos' && (
            <div>
              <div className="cp-stitle cp-a">Compra tu boleto</div>
              {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.2)' }}>Cargando...</div> :
                eventos.filter(e => !e.es_gratuito && e.precio_default > 0).map((e, i) => {
                  const f = fmtDate(e.fecha);
                  const img = EVENT_IMAGES[e.slug];
                  if (img) {
                    return (
                      <div key={e.id} className={`cp-ev cp-a cp-a${i + 1}`} onClick={() => selectEvento(e)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={e.nombre} className="cp-ev-img" />
                        <div className="cp-ev-overlay">
                          <div className="cp-ev-tt">{e.nombre}</div>
                          {e.descripcion && <div className="cp-ev-ds">{e.descripcion}</div>}
                          <div className="cp-ev-ft">
                            <div className="cp-ev-pr">${e.precio_default.toLocaleString()}</div>
                            {e.tiene_asientos && <div className="cp-ev-bg">Con asientos</div>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={e.id} className={`cp-ec cp-a cp-a${i + 1}`} onClick={() => selectEvento(e)}>
                      <div className="cp-ec-in">
                        <div className="cp-ec-dt"><div className="cp-ec-dd">{f.day}</div><div className="cp-ec-dm">{f.mon}</div></div>
                        <div className="cp-ec-nf">
                          <div className="cp-ec-tt">{e.nombre}</div>
                          {e.descripcion && <div className="cp-ec-ds">{e.descripcion}</div>}
                          <div className="cp-ec-ft">
                            <div className="cp-ec-pr">${e.precio_default.toLocaleString()}</div>
                            {e.tiene_asientos && <div className="cp-ev-bg">Con asientos</div>}
                          </div>
                        </div>
                        <div className="cp-ec-ar">›</div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* DATOS */}
          {step === 'datos' && selectedEvento && (
            <div>
              {/* Mini event header with image if available */}
              {EVENT_IMAGES[selectedEvento.slug] ? (
                <div className="cp-cd cp-a" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ position: 'relative', height: 100 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={EVENT_IMAGES[selectedEvento.slug]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,.8))', display: 'flex', alignItems: 'flex-end', padding: '12px 16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15 }}>{selectedEvento.nombre}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{fmtDate(selectedEvento.fecha).full}</div>
                      </div>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: '#00e5ff' }}>${selectedEvento.precio_default.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cp-cd cp-a" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15 }}>{selectedEvento.nombre}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{fmtDate(selectedEvento.fecha).full}</div>
                  </div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: '#00e5ff' }}>${selectedEvento.precio_default.toLocaleString()}</div>
                </div>
              )}

              <div className="cp-cd cp-a cp-a1">
                <div className="cp-ct">Tus datos</div>
                <div className="cp-fl"><label className="cp-lb">Nombre completo *</label><input className="cp-in" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" /></div>
                <div className="cp-fl"><label className="cp-lb">Correo electrónico *</label><input type="email" className="cp-in" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="Para enviarte tu boleto" /></div>
                <div className="cp-fl"><label className="cp-lb">Teléfono / WhatsApp</label><input type="tel" className="cp-in" value={telefono} onChange={e => { setTelefono(e.target.value); setWhatsapp(e.target.value); }} placeholder="10 dígitos" /></div>
                {hasEquipos && equipos.some(e => e.genero) && (
                  <div className="cp-fl"><label className="cp-lb">Edad</label><input type="number" className="cp-in" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Tu edad" /></div>
                )}
                <div className="cp-fl">
                  <label className="cp-lb">Nación</label>
                  <select className="cp-in" value={nacionId} onChange={e => setNacionId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {naciones.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                  </select>
                </div>
                {hasEquipos && (
                  <div className="cp-fl">
                    <label className="cp-lb">Escuadrón</label>
                    {(() => {
                      const gs = Array.from(new Set(equipos.map(e => e.genero).filter(Boolean)));
                      if (gs.length > 0) return gs.map(g => (
                        <div key={g}>
                          <div className="cp-gd">{g === 'mujeres' ? '♀ Mujeres' : '♂ Hombres'}</div>
                          {equipos.filter(eq => eq.genero === g).map(eq => (
                            <button key={eq.id} className={`cp-eq ${equipoId === eq.id ? 'sel' : ''}`} onClick={() => setEquipoId(eq.id)}>
                              <div className="cp-eq-d" style={{ background: eq.color }} />
                              <div className="cp-eq-i"><div className="cp-eq-n">{eq.nombre}</div>
                                {(eq.lider || eq.consejero) && <div className="cp-eq-s">{eq.lider && `Líder: ${eq.lider}`}{eq.lider && eq.consejero && ' · '}{eq.consejero && `Consejero: ${eq.consejero}`}</div>}
                              </div>
                              <div className="cp-eq-c">{equipoId === eq.id ? '✓' : ''}</div>
                            </button>
                          ))}
                        </div>
                      ));
                      return equipos.map(eq => (
                        <button key={eq.id} className={`cp-eq ${equipoId === eq.id ? 'sel' : ''}`} onClick={() => setEquipoId(eq.id)}>
                          <div className="cp-eq-d" style={{ background: eq.color }} /><div className="cp-eq-i"><div className="cp-eq-n">{eq.nombre}</div></div>
                          <div className="cp-eq-c">{equipoId === eq.id ? '✓' : ''}</div>
                        </button>
                      ));
                    })()}
                  </div>
                )}
                <div className="cp-fl">
                  <label className="cp-lb">Boletos</label>
                  <div className="cp-qty">
                    <button className="cp-qb" onClick={() => setNumBoletos(Math.max(1, numBoletos - 1))}>−</button>
                    <div className="cp-qn">{numBoletos}</div>
                    <button className="cp-qb" onClick={() => setNumBoletos(numBoletos + 1)}>+</button>
                    <div className="cp-qt">Total: <b>${total.toLocaleString()}</b></div>
                  </div>
                </div>
              </div>

              {error && <div className="cp-err">{error}</div>}
              <button className="cp-bp cp-a cp-a2" onClick={nextFromDatos}>
                {selectedEvento.tiene_asientos ? 'Seleccionar asientos →' : 'Continuar al pago →'}
              </button>
            </div>
          )}

          {/* ASIENTOS */}
          {step === 'asientos' && selectedEvento?.tiene_asientos && (
            <div>
              <div className="cp-cd cp-a">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="cp-ct" style={{ marginBottom: 0 }}>Elige tu lugar</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(16,185,129,.4)' }}></span>Libre</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#00e5ff' }}></span>Tuyo</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(0,229,255,.2)' }}></span>Ocupado</span>
                  </div>
                </div>
                <SeatMap asientos={asientos} selectedSeats={selectedSeats} onSeatClick={handleSeatClick} />
              </div>
              {error && <div className="cp-err">{error}</div>}
              <div className="cp-sbar">
                <div className="cp-sbar-in">
                  <div>{selectedSeats.length > 0 ? (
                    <div className="cp-sbar-seats">{selectedSeats.map(id => <span key={id} className="cp-sb">{seatLabel(id)}</span>)}</div>
                  ) : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>Toca un asiento</span>}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="cp-bk" onClick={() => { setStep('datos'); setError(''); }}>← Atrás</button>
                    <button className="cp-bp" style={{ width: 'auto', padding: '10px 18px', fontSize: 13 }} onClick={nextFromAsientos}>Pagar →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGO */}
          {step === 'pago' && selectedEvento && (
            <div>
              <div className="cp-cd cp-a">
                <div className="cp-ct">Resumen</div>
                <div className="cp-sr"><span className="cp-sl">Evento</span><span className="cp-sv">{selectedEvento.nombre}</span></div>
                <div className="cp-sr"><span className="cp-sl">Nombre</span><span className="cp-sv">{nombre}</span></div>
                <div className="cp-sr"><span className="cp-sl">Correo</span><span className="cp-sv" style={{ fontSize: 12 }}>{correo}</span></div>
                {selectedSeats.length > 0 && (
                  <div className="cp-sr"><span className="cp-sl">Asientos</span><span className="cp-sv" style={{ display: 'flex', gap: 4 }}>
                    {selectedSeats.map(id => <span key={id} className="cp-sb">{seatLabel(id)}</span>)}
                  </span></div>
                )}
                <div className="cp-sr"><span className="cp-sl">Boletos</span><span className="cp-sv">{numBoletos} × ${selectedEvento.precio_default.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 6, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                  <span className="cp-stot">${total.toLocaleString()}</span>
                </div>
              </div>
              <div className="cp-cd cp-a cp-a1">
                <div className="cp-ct">Pagar</div>
                {processing && <div style={{ textAlign: 'center', padding: 16, color: 'rgba(255,255,255,.2)', fontSize: 13 }}>Preparando...</div>}
                <div id="wallet_container" ref={walletRef}></div>
              </div>
              {error && <div className="cp-err">{error}</div>}
              <button className="cp-bs cp-a cp-a2" onClick={() => { setStep(selectedEvento.tiene_asientos ? 'asientos' : 'datos'); setError(''); }}>← Volver</button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
