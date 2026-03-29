'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Asiento, Nacion } from '@/types';
import SeatMap from '@/components/SeatMap';
import Script from 'next/script';

interface Evento {
  id: string; nombre: string; slug: string; fecha: string; descripcion: string;
  precio_default: number; tiene_asientos: boolean; es_gratuito: boolean; usa_equipos: boolean;
}
declare global { interface Window { MercadoPago: any; } }

const EVENT_IMAGES: Record<string, string> = {
  'legacy-women': '/flyer-legacy-women.jpg',
  'legacy-varones': '/flyer-legacy-varones.jpg',
};

export default function ComprarPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [ev, setEv] = useState<Evento | null>(null);
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
  const [step, setStep] = useState<'eventos'|'datos'|'asientos'|'pago'>('eventos');
  const walletRef = useRef<HTMLDivElement>(null);
  const mpInstanceRef = useRef<any>(null);

  useEffect(() => {
    supabase.from('eventos').select('*').eq('activo', true).eq('compra_online', true).order('fecha')
      .then(({ data }) => { if (data) setEventos(data as Evento[]); setLoading(false); });
  }, []);

  const loadData = useCallback(async (e: Evento) => {
    const [n, eq, a] = await Promise.all([
      supabase.from('naciones').select('*').order('nombre'),
      supabase.from('equipos_evento').select('*').eq('evento_id', e.id).order('nombre'),
      e.tiene_asientos ? supabase.from('asientos').select('*').eq('evento_id', e.id) : Promise.resolve({ data: [] }),
    ]);
    if (n.data) setNaciones(n.data); if (eq.data) setEquipos(eq.data); if (a.data) setAsientos(a.data as Asiento[]);
  }, []);

  const pick = (e: Evento) => { setEv(e); loadData(e); setStep('datos'); };
  const seatClick = (id: string) => setSelectedSeats(p => p.includes(id) ? p.filter(s=>s!==id) : p.length>=numBoletos ? [...p.slice(1),id] : [...p,id]);
  const goAsientos = () => { if(!nombre.trim()){setError('Ingresa tu nombre');return;} if(!correo.trim()){setError('Ingresa tu correo');return;} setError(''); setStep(ev?.tiene_asientos?'asientos':'pago'); };
  const goPago = () => { if(selectedSeats.length<numBoletos){setError(`Selecciona ${numBoletos} asiento${numBoletos>1?'s':''}`);return;} setError(''); setStep('pago'); };

  const initMP = useCallback(async () => {
    if (!ev||!mpReady) return; setProcessing(true); setError('');
    try {
      const r = await fetch('/api/mercadopago/create-preference', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ eventoId:ev.id, nombre:nombre.trim(), correo:correo.trim(), telefono:telefono.trim()||null, whatsapp:whatsapp.trim()||null, edad:edad||null, nacionId:nacionId||null, equipoId:equipoId||null, asientoIds:selectedSeats.length>0?selectedSeats:null, cantidad:numBoletos })});
      const d = await r.json(); if(!r.ok) throw new Error(d.error);
      if(mpInstanceRef.current) { try { await mpInstanceRef.current.bricks().destroy('wallet_container'); } catch {} }
      if(walletRef.current) walletRef.current.innerHTML='';
      const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,{locale:'es-MX'});
      mpInstanceRef.current = mp;
      await mp.bricks().create('wallet','wallet_container',{initialization:{preferenceId:d.preferenceId}});
      setProcessing(false);
    } catch(e:any){setError(e.message||'Error');setProcessing(false);}
  },[ev,mpReady,nombre,correo,telefono,whatsapp,edad,nacionId,equipoId,selectedSeats,numBoletos]);

  useEffect(()=>{if(step==='pago'&&mpReady)initMP();},[step,mpReady,initMP]);

  const total = (ev?.precio_default||0)*numBoletos;
  const hasEq = equipos.length>0;
  const fmt = (f:string) => { const d=new Date(f+'T12:00:00'); return { day:d.getDate(), mon:d.toLocaleDateString('es-MX',{month:'short'}).toUpperCase(), full:d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) }; };
  const sl = (id:string) => { const s=asientos.find(a=>a.id===id); return s?`${s.fila}${s.columna}`:id; };
  const reset = () => { setStep('eventos'); setEv(null); setSelectedSeats([]); setError(''); };

  return (<>
    <Script src="https://sdk.mercadopago.com/js/v2" onLoad={()=>setMpReady(true)} />
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      .bp{min-height:100dvh;font-family:'Plus Jakarta Sans',sans-serif;overflow-x:hidden;position:relative}
      .bp *{box-sizing:border-box}

      /* ---- PANTALLA EVENTOS (dark) ---- */
      .bp-dark{background:#0c1120;color:#fff}
      .bp-hdr{padding:20px 20px 0;max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
      .bp-hdr img{height:30px}
      .bp-hero{max-width:480px;margin:0 auto;padding:20px}
      .bp-hero-title{font-size:26px;font-weight:800;line-height:1.15;margin-bottom:4px}
      .bp-hero-sub{font-size:13px;color:rgba(255,255,255,.45);margin-bottom:24px}

      .bp-evcard{border-radius:16px;overflow:hidden;margin-bottom:16px;cursor:pointer;transition:.25s;position:relative}
      .bp-evcard:active{transform:scale(.97)}
      .bp-evcard img{width:100%;height:180px;object-fit:cover;display:block}
      .bp-evcard-info{padding:14px 16px;background:#161d30}
      .bp-evcard-name{font-size:15px;font-weight:700;margin-bottom:4px}
      .bp-evcard-row{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.5)}
      .bp-evcard-row svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}
      .bp-evcard-price{position:absolute;top:12px;right:12px;background:#00e5ff;color:#0c1120;font-weight:800;font-size:13px;padding:5px 12px;border-radius:20px}

      /* Card sin imagen */
      .bp-evcard-noimg{display:flex;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;margin-bottom:14px;cursor:pointer;transition:.25s}
      .bp-evcard-noimg:active{transform:scale(.97)}
      .bp-evcard-dt{width:64px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,229,255,.06);padding:14px 0}
      .bp-evcard-dd{font-size:24px;font-weight:800;color:#00e5ff}
      .bp-evcard-dm{font-size:9px;font-weight:700;color:rgba(0,229,255,.5);letter-spacing:1px;margin-top:1px}
      .bp-evcard-body{flex:1;padding:14px 16px;display:flex;flex-direction:column;justify-content:center}

      /* ---- PANTALLA DATOS/PAGO (light bottom sheet) ---- */
      .bp-detail{min-height:100dvh;display:flex;flex-direction:column}
      .bp-detail-hero{position:relative;flex-shrink:0;overflow:hidden;padding-bottom:24px;background:#e8e0d8}
      .bp-detail-hero img{width:100%;display:block}
      .bp-detail-hero-grad{position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(transparent,rgba(0,0,0,.4))}
      .bp-detail-back{position:absolute;top:16px;left:16px;z-index:2;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.4);backdrop-filter:blur(10px);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px}
      .bp-detail-hero-noimg{height:120px;background:linear-gradient(135deg,#0c1120,#1a2744);display:flex;align-items:flex-end;padding:20px;position:relative}

      .bp-sheet{background:#f8f9fb;border-radius:24px 24px 0 0;margin-top:-24px;position:relative;flex:1;z-index:1;color:#111}
      .bp-sheet *{color:inherit}
      .bp-sheet input, .bp-sheet select{color:#111 !important}
      .bp-sheet input::placeholder{color:#bbb !important}
      .bp-sheet-handle{width:36px;height:4px;border-radius:2px;background:#d1d5db;margin:12px auto 0}
      .bp-sheet-inner{max-width:480px;margin:0 auto;padding:20px 20px 32px}

      /* Sheet header */
      .bp-sh-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
      .bp-sh-name{font-size:20px;font-weight:800;color:#111;line-height:1.2}
      .bp-sh-price{background:#00e5ff;color:#0c1120;font-weight:800;font-size:14px;padding:6px 14px;border-radius:20px;flex-shrink:0;margin-left:12px}

      /* Info pills */
      .bp-info-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#666}
      .bp-info-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}

      /* Steps */
      .bp-steps{display:flex;gap:4px;margin-bottom:20px}
      .bp-stp{flex:1;height:4px;border-radius:2px;transition:.3s}
      .bp-stp.on{background:#00e5ff}.bp-stp.off{background:#e5e7eb}

      /* Form on white bg */
      .bp-form-title{font-size:15px;font-weight:700;color:#111;margin:20px 0 12px}
      .bp-field{margin-bottom:12px}
      .bp-flabel{display:block;font-size:11px;font-weight:600;color:#888;margin-bottom:4px;letter-spacing:.3px;text-transform:uppercase}
      .bp-finput{width:100%;padding:12px 14px;border-radius:12px;font-size:14px;background:#fff;border:1.5px solid #e5e7eb;color:#111;outline:none;font-family:'Plus Jakarta Sans',sans-serif;transition:.2s}
      .bp-finput:focus{border-color:#00bcd4;box-shadow:0 0 0 3px rgba(0,188,212,.1)}
      .bp-finput::placeholder{color:#bbb}
      select.bp-finput{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;background-color:#fff}

      /* Quantity */
      .bp-qty{display:flex !important;flex-direction:row !important;align-items:center !important;gap:14px;background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;padding:12px 16px}
      .bp-qbtn{width:42px;height:42px;border-radius:12px;border:1.5px solid #e5e7eb;background:#f8f9fb;color:#111 !important;font-size:20px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s;-webkit-appearance:none}
      .bp-qbtn:active{background:#e0f7fa;border-color:#00bcd4}
      .bp-qnum{font-size:32px;font-weight:800;color:#111 !important;min-width:40px;text-align:center;flex-shrink:0}
      .bp-qtot{font-size:14px;color:#666 !important;margin-left:auto;white-space:nowrap}.bp-qtot b{color:#00bcd4 !important;font-weight:800;font-size:16px}

      /* Equipo on white */
      .bp-eqbtn{width:100%;text-align:left;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:#fff;border:1.5px solid #e5e7eb;color:#333;cursor:pointer;transition:.15s;display:flex;align-items:center;gap:10px;font-family:'Plus Jakarta Sans',sans-serif}
      .bp-eqbtn.sel{border-color:#00e5ff;background:#f0feff}
      .bp-eqbtn-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
      .bp-eqbtn-i{flex:1}
      .bp-eqbtn-n{font-size:13px;font-weight:600}
      .bp-eqbtn-s{font-size:10px;color:#999;margin-top:1px}
      .bp-eqbtn-c{width:18px;height:18px;border-radius:50%;border:2px solid #ddd;display:flex;align-items:center;justify-content:center;font-size:10px}
      .bp-eqbtn.sel .bp-eqbtn-c{background:#00e5ff;border-color:#00e5ff;color:#fff}
      .bp-gendiv{font-size:10px;font-weight:700;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;margin:12px 0 6px}

      /* Primary button */
      .bp-btn{width:100%;padding:16px;border-radius:16px;font-size:16px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:.2s;background:#0c1120;color:#fff;letter-spacing:.3px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
      .bp-btn:active{transform:scale(.97);opacity:.9}
      .bp-btn:disabled{opacity:.35;cursor:not-allowed;transform:none}
      .bp-btn-accent{background:linear-gradient(135deg,#00e5ff,#00b8d4);color:#0c1120;box-shadow:0 4px 20px rgba(0,229,255,.25)}
      .bp-btn-outline{background:#fff;border:1.5px solid #e5e7eb;color:#888 !important;box-shadow:none}

      /* Summary */
      .bp-sumrow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#666}
      .bp-sumrow:last-child{border:none}
      .bp-sumval{font-weight:600;color:#111}
      .bp-sumtot{font-size:22px;font-weight:800;color:#00bcd4}
      .bp-badge{padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#00e5ff;color:#0c1120}

      .bp-err{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px;font-size:12px;color:#dc2626;text-align:center;margin-bottom:12px}

      /* Seat bar */
      .bp-sbar{position:sticky;bottom:0;z-index:40;background:rgba(248,249,251,.97);backdrop-filter:blur(20px);border-top:1px solid #eee;padding:12px 16px;color:#111}
      .bp-sbar-in{max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px}

      @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      .bp-anim{animation:slideUp .4s ease-out both}
      .bp-anim1{animation-delay:.05s}.bp-anim2{animation-delay:.1s}.bp-anim3{animation-delay:.15s}
    `}</style>

    <div className="bp">
      {/* ========== EVENTOS LIST ========== */}
      {step==='eventos' && (
        <div className="bp-dark">
          <div className="bp-hdr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-rn.png" alt="RN México" />
          </div>
          <div className="bp-hero">
            <div className="bp-hero-title">Descubre<br/>nuestros eventos</div>
            <div className="bp-hero-sub">Compra tu boleto en línea de forma segura</div>

            {loading ? <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,.3)'}}>Cargando...</div> :
              eventos.filter(e=>!e.es_gratuito&&e.precio_default>0).map((e,i) => {
                const f=fmt(e.fecha); const img=EVENT_IMAGES[e.slug];
                if(img) return (
                  <div key={e.id} className="bp-evcard bp-anim" style={{animationDelay:`${i*.08}s`}} onClick={()=>pick(e)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={e.nombre} />
                    <div className="bp-evcard-price">${e.precio_default.toLocaleString()}</div>
                    <div className="bp-evcard-info">
                      <div className="bp-evcard-name">{e.nombre}</div>
                      <div className="bp-evcard-row">
                        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        {f.full}
                        {e.tiene_asientos && <> · <span style={{color:'#00e5ff'}}>Con asientos</span></>}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div key={e.id} className="bp-evcard-noimg bp-anim" style={{animationDelay:`${i*.08}s`}} onClick={()=>pick(e)}>
                    <div className="bp-evcard-dt"><div className="bp-evcard-dd">{f.day}</div><div className="bp-evcard-dm">{f.mon}</div></div>
                    <div className="bp-evcard-body">
                      <div className="bp-evcard-name">{e.nombre}</div>
                      <div className="bp-evcard-row" style={{marginTop:4}}>
                        {e.descripcion && <span>{e.descripcion}</span>}
                      </div>
                      <div style={{marginTop:6}}><span style={{color:'#00e5ff',fontWeight:800,fontSize:16}}>${e.precio_default.toLocaleString()}</span>
                        {e.tiene_asientos && <span style={{marginLeft:8,fontSize:9,padding:'2px 8px',borderRadius:10,background:'rgba(0,229,255,.15)',color:'#00e5ff',fontWeight:600}}>Con asientos</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ========== DETAIL VIEW (datos/asientos/pago) ========== */}
      {ev && step!=='eventos' && (
        <div className="bp-detail">
          {/* Hero */}
          {EVENT_IMAGES[ev.slug] ? (
            <div className="bp-detail-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={EVENT_IMAGES[ev.slug]} alt={ev.nombre} />
              <div className="bp-detail-hero-grad" />
              <button className="bp-detail-back" onClick={reset}>‹</button>
            </div>
          ) : (
            <div className="bp-detail-hero-noimg">
              <button className="bp-detail-back" onClick={reset}>‹</button>
              <div style={{position:'absolute',bottom:20,left:20}}>
                <div style={{fontSize:22,fontWeight:800,color:'#fff'}}>{ev.nombre}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:2}}>{fmt(ev.fecha).full}</div>
              </div>
            </div>
          )}

          {/* White sheet */}
          <div className="bp-sheet">
            <div className="bp-sheet-handle" />
            <div className="bp-sheet-inner">
              {/* Header with name + price */}
              <div className="bp-sh-hdr">
                <div>
                  <div className="bp-sh-name">{ev.nombre}</div>
                  <div style={{fontSize:12,color:'#888',marginTop:4}}>{ev.descripcion}</div>
                </div>
                <div className="bp-sh-price">${ev.precio_default.toLocaleString()}</div>
              </div>

              {/* Info pills */}
              <div className="bp-info-row">
                <div className="bp-info-icon" style={{background:'#fff0f0',color:'#e74c3c'}}>📅</div>
                <div><div style={{fontWeight:600,color:'#333'}}>{fmt(ev.fecha).full}</div></div>
              </div>
              {ev.tiene_asientos && (
                <div className="bp-info-row" style={{borderBottom:'none'}}>
                  <div className="bp-info-icon" style={{background:'#f0feff',color:'#00bcd4'}}>💺</div>
                  <div><div style={{fontWeight:600,color:'#333'}}>Asientos numerados</div><div style={{fontSize:11,color:'#999'}}>Elige tu lugar</div></div>
                </div>
              )}

              {/* Step progress */}
              <div className="bp-steps" style={{marginTop:16}}>
                {['datos',ev.tiene_asientos?'asientos':null,'pago'].filter(Boolean).map((s,i,arr) => {
                  const ci = arr.indexOf(step); const on = i<=ci;
                  return <div key={s} className={`bp-stp ${on?'on':'off'}`} />;
                })}
              </div>

              {/* ---- DATOS ---- */}
              {step==='datos' && (<div className="bp-anim">
                <div className="bp-form-title">Tus datos</div>
                <div className="bp-field"><label className="bp-flabel">Nombre *</label><input className="bp-finput" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" /></div>
                <div className="bp-field"><label className="bp-flabel">Correo *</label><input type="email" className="bp-finput" value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="Para enviarte tu boleto" /></div>
                <div className="bp-field"><label className="bp-flabel">Teléfono / WhatsApp</label><input type="tel" className="bp-finput" value={telefono} onChange={e=>{setTelefono(e.target.value);setWhatsapp(e.target.value);}} placeholder="10 dígitos" /></div>
                {hasEq && equipos.some(e=>e.genero) && (
                  <div className="bp-field"><label className="bp-flabel">Edad</label><input type="number" className="bp-finput" value={edad} onChange={e=>setEdad(e.target.value)} placeholder="Tu edad" /></div>
                )}
                <div className="bp-field">
                  <label className="bp-flabel">Nación</label>
                  <select className="bp-finput" value={nacionId} onChange={e=>setNacionId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {naciones.map(n=><option key={n.id} value={n.id}>{n.nombre}</option>)}
                  </select>
                </div>
                {hasEq && (
                  <div className="bp-field">
                    <label className="bp-flabel">Escuadrón</label>
                    {(()=>{
                      const gs=Array.from(new Set(equipos.map(e=>e.genero).filter(Boolean)));
                      if(gs.length>0) return gs.map(g=>(<div key={g}>
                        <div className="bp-gendiv">{g==='mujeres'?'♀ Mujeres':'♂ Hombres'}</div>
                        {equipos.filter(eq=>eq.genero===g).map(eq=>(
                          <button key={eq.id} className={`bp-eqbtn ${equipoId===eq.id?'sel':''}`} onClick={()=>setEquipoId(eq.id)}>
                            <div className="bp-eqbtn-dot" style={{background:eq.color}} />
                            <div className="bp-eqbtn-i"><div className="bp-eqbtn-n">{eq.nombre}</div>
                              {(eq.lider||eq.consejero)&&<div className="bp-eqbtn-s">{eq.lider&&`Líder: ${eq.lider}`}{eq.lider&&eq.consejero&&' · '}{eq.consejero&&`Consejero: ${eq.consejero}`}</div>}
                            </div>
                            <div className="bp-eqbtn-c">{equipoId===eq.id?'✓':''}</div>
                          </button>
                        ))}
                      </div>));
                      return equipos.map(eq=>(<button key={eq.id} className={`bp-eqbtn ${equipoId===eq.id?'sel':''}`} onClick={()=>setEquipoId(eq.id)}>
                        <div className="bp-eqbtn-dot" style={{background:eq.color}} /><div className="bp-eqbtn-i"><div className="bp-eqbtn-n">{eq.nombre}</div></div>
                        <div className="bp-eqbtn-c">{equipoId===eq.id?'✓':''}</div>
                      </button>));
                    })()}
                  </div>
                )}
                <div className="bp-field">
                  <label className="bp-flabel">Boletos</label>
                  <div style={{display:'flex',flexDirection:'row',alignItems:'center',gap:14,background:'#fff',border:'1.5px solid #e5e7eb',borderRadius:14,padding:'12px 16px'}}>
                    <button onClick={()=>setNumBoletos(Math.max(1,numBoletos-1))}
                      style={{width:44,height:44,borderRadius:12,border:'1.5px solid #ddd',background:'#f5f5f5',color:'#111',fontSize:22,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>−</button>
                    <span style={{fontSize:34,fontWeight:800,color:'#111',minWidth:40,textAlign:'center',flexShrink:0,lineHeight:1}}>{numBoletos}</span>
                    <button onClick={()=>setNumBoletos(numBoletos+1)}
                      style={{width:44,height:44,borderRadius:12,border:'1.5px solid #ddd',background:'#f5f5f5',color:'#111',fontSize:22,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>+</button>
                    <span style={{fontSize:14,color:'#888',marginLeft:'auto',whiteSpace:'nowrap'}}>Total: <b style={{color:'#00bcd4',fontWeight:800,fontSize:17}}>${total.toLocaleString()}</b></span>
                  </div>
                </div>

                {error && <div className="bp-err">{error}</div>}
                <button onClick={goAsientos}
                  style={{width:'100%',padding:16,borderRadius:16,fontSize:16,fontWeight:800,border:'none',cursor:'pointer',background:'#0c1120',color:'#fff',marginTop:12,boxShadow:'0 4px 16px rgba(0,0,0,.15)',letterSpacing:'.3px'}}>
                  {ev.tiene_asientos ? 'Elegir asientos →' : `Comprar boleto — $${total.toLocaleString()}`}
                </button>
              </div>)}

              {/* ---- ASIENTOS ---- */}
              {step==='asientos' && ev.tiene_asientos && (<div className="bp-anim">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <div style={{fontSize:18,fontWeight:800,color:'#111'}}>Elige tu lugar</div>
                  <div style={{display:'flex',gap:10,fontSize:10,color:'#888'}}>
                    <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:8,height:8,borderRadius:3,background:'#a8e6cf'}}></span>Libre</span>
                    <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:8,height:8,borderRadius:3,background:'#00bcd4'}}></span>Tuyo</span>
                    <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:8,height:8,borderRadius:3,background:'#ccc'}}></span>Ocupado</span>
                  </div>
                </div>

                {/* Seat map - scrollable container for mobile */}
                <div style={{background:'#111827',borderRadius:16,marginBottom:20,overflow:'hidden'}}>
                  <div style={{padding:'8px 12px 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>← Desliza para ver todo el mapa →</span>
                  </div>
                  <div style={{overflowX:'scroll',overflowY:'hidden',WebkitOverflowScrolling:'touch',padding:'0 8px 12px'}}>
                    <div style={{minWidth:680}}>
                      <SeatMap asientos={asientos} selectedSeats={selectedSeats} onSeatClick={seatClick} />
                    </div>
                  </div>
                </div>

                {/* Selected seats display */}
                {selectedSeats.length > 0 && (
                  <div style={{background:'#f0feff',border:'1.5px solid #b2ebf2',borderRadius:14,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#00838f'}}>Seleccionados:</span>
                    {selectedSeats.map(id => (
                      <span key={id} style={{background:'#00bcd4',color:'#fff',padding:'6px 14px',borderRadius:10,fontSize:14,fontWeight:800,letterSpacing:'.5px'}}>{sl(id)}</span>
                    ))}
                  </div>
                )}

                {error && <div className="bp-err">{error}</div>}

                {/* Action buttons */}
                <div style={{display:'flex',gap:10,marginBottom:16}}>
                  <button onClick={()=>{setStep('datos');setError('');}}
                    style={{flex:1,padding:14,borderRadius:14,fontSize:14,fontWeight:700,border:'1.5px solid #e5e7eb',background:'#fff',color:'#888',cursor:'pointer'}}>
                    ← Atrás
                  </button>
                  <button onClick={goPago}
                    style={{flex:2,padding:14,borderRadius:14,fontSize:15,fontWeight:800,border:'none',background:'#0c1120',color:'#fff',cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,.15)'}}>
                    Pagar ${total.toLocaleString()} →
                  </button>
                </div>
              </div>)}

              {/* ---- PAGO ---- */}
              {step==='pago' && (<div className="bp-anim">
                <div className="bp-form-title">Resumen de compra</div>
                <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #eee',marginBottom:16}}>
                  <div className="bp-sumrow"><span>Evento</span><span className="bp-sumval">{ev.nombre}</span></div>
                  <div className="bp-sumrow"><span>Nombre</span><span className="bp-sumval">{nombre}</span></div>
                  <div className="bp-sumrow"><span>Correo</span><span className="bp-sumval" style={{fontSize:12}}>{correo}</span></div>
                  {selectedSeats.length>0&&(<div className="bp-sumrow"><span>Asientos</span><span style={{display:'flex',gap:4}}>{selectedSeats.map(id=><span key={id} className="bp-badge">{sl(id)}</span>)}</span></div>)}
                  <div className="bp-sumrow"><span>Boletos</span><span className="bp-sumval">{numBoletos} × ${ev.precio_default.toLocaleString()}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:12,marginTop:8,borderTop:'1.5px solid #eee'}}>
                    <span style={{fontSize:14,fontWeight:600,color:'#333'}}>Total</span>
                    <span className="bp-sumtot">${total.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #eee',marginBottom:16}}>
                  <div className="bp-form-title" style={{marginTop:0}}>Método de pago</div>
                  {processing&&<div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>Preparando opciones...</div>}
                  <div id="wallet_container" ref={walletRef}></div>
                </div>

                {error && <div className="bp-err">{error}</div>}
                <button className="bp-btn bp-btn-outline" onClick={()=>{setStep(ev.tiene_asientos?'asientos':'datos');setError('');}}>← Volver</button>
              </div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
}
