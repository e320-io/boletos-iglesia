'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Evento {
  id: string;
  nombre: string;
  slug: string;
  fecha: string;
  descripcion: string;
  precio_default: number;
  tiene_asientos: boolean;
  es_gratuito: boolean;
  usa_fases_precio: boolean;
  usa_equipos: boolean;
  ministerio: string | null;
  activo: boolean;
}

interface FasePrecio {
  id?: string;
  nombre: string;
  precio: number;
  fecha_inicio: string;
  fecha_fin: string;
}

interface Equipo {
  id?: string;
  nombre: string;
  color: string;
}

export default function EventManager({ onBack }: { onBack: () => void }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ministerio, setMinisterio] = useState('');
  const [esGratuito, setEsGratuito] = useState(false);
  const [precioDefault, setPrecioDefault] = useState(550);
  const [tieneAsientos, setTieneAsientos] = useState(false);
  const [usaFasesPrecio, setUsaFasesPrecio] = useState(false);
  const [usaEquipos, setUsaEquipos] = useState(false);
  const [fases, setFases] = useState<FasePrecio[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchEventos = useCallback(async () => {
    const { data } = await supabase.from('eventos').select('*').order('fecha', { ascending: false });
    if (data) setEventos(data as Evento[]);
  }, []);

  useEffect(() => { fetchEventos(); }, [fetchEventos]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const resetForm = () => {
    setNombre(''); setSlug(''); setFecha(''); setDescripcion(''); setMinisterio('');
    setEsGratuito(false); setPrecioDefault(550); setTieneAsientos(false);
    setUsaFasesPrecio(false); setUsaEquipos(false);
    setFases([]); setEquipos([]);
    setFormError(''); setFormSuccess('');
  };

  const loadEventForEdit = async (evento: Evento) => {
    setEditing(evento);
    setCreating(false);
    setNombre(evento.nombre);
    setSlug(evento.slug);
    setFecha(evento.fecha || '');
    setDescripcion(evento.descripcion || '');
    setMinisterio(evento.ministerio || '');
    setEsGratuito(evento.es_gratuito);
    setPrecioDefault(evento.precio_default);
    setTieneAsientos(evento.tiene_asientos);
    setUsaFasesPrecio(evento.usa_fases_precio);
    setUsaEquipos(evento.usa_equipos);

    // Load fases
    const { data: fasesData } = await supabase.from('fases_precio').select('*').eq('evento_id', evento.id).order('fecha_inicio');
    if (fasesData) setFases(fasesData);

    // Load equipos
    const { data: equiposData } = await supabase.from('equipos_evento').select('*').eq('evento_id', evento.id).order('nombre');
    if (equiposData) setEquipos(equiposData);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setFormError('El nombre es requerido'); return; }
    if (!slug.trim()) { setFormError('El slug es requerido'); return; }
    if (!fecha) { setFormError('La fecha es requerida'); return; }

    setLoading(true);
    setFormError('');
    try {
      const eventoData = {
        nombre: nombre.trim(),
        slug: slug.trim().toLowerCase(),
        fecha,
        descripcion: descripcion.trim() || null,
        ministerio: ministerio.trim() || null,
        es_gratuito: esGratuito,
        precio_default: esGratuito ? 0 : precioDefault,
        tiene_asientos: tieneAsientos,
        usa_fases_precio: usaFasesPrecio,
        usa_equipos: usaEquipos,
      };

      let eventoId: string;

      if (editing) {
        const { error } = await supabase.from('eventos').update(eventoData).eq('id', editing.id);
        if (error) throw error;
        eventoId = editing.id;
      } else {
        const { data, error } = await supabase.from('eventos').insert(eventoData).select().single();
        if (error) throw error;
        eventoId = data.id;
      }

      // Save fases de precio
      if (usaFasesPrecio) {
        await supabase.from('fases_precio').delete().eq('evento_id', eventoId);
        if (fases.length > 0) {
          const fasesInsert = fases.map(f => ({
            evento_id: eventoId, nombre: f.nombre, precio: f.precio,
            fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin,
          }));
          await supabase.from('fases_precio').insert(fasesInsert);
        }
      }

      // Save equipos
      if (usaEquipos) {
        // Delete removed equipos (only those not in the new list)
        const existingIds = equipos.filter(e => e.id).map(e => e.id!);
        if (editing) {
          await supabase.from('equipos_evento').delete().eq('evento_id', eventoId).not('id', 'in', `(${existingIds.join(',')})`);
        }
        for (const eq of equipos) {
          if (eq.id) {
            await supabase.from('equipos_evento').update({ nombre: eq.nombre, color: eq.color }).eq('id', eq.id);
          } else {
            await supabase.from('equipos_evento').insert({ evento_id: eventoId, nombre: eq.nombre, color: eq.color });
          }
        }
      }

      setFormSuccess(editing ? 'Evento actualizado' : 'Evento creado');
      setTimeout(() => {
        resetForm(); setEditing(null); setCreating(false); setFormSuccess('');
        fetchEventos();
      }, 1500);
    } catch (error: any) {
      setFormError(error.message?.includes('unique') ? 'El slug ya existe, usa otro' : error.message);
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('eventos').update({ activo: !active }).eq('id', id);
    fetchEventos();
  };

  const addFase = () => setFases([...fases, { nombre: '', precio: 0, fecha_inicio: '', fecha_fin: '' }]);
  const removeFase = (i: number) => setFases(fases.filter((_, idx) => idx !== i));
  const updateFase = (i: number, field: keyof FasePrecio, value: any) => {
    const updated = [...fases]; (updated[i] as any)[field] = value; setFases(updated);
  };

  const addEquipo = () => setEquipos([...equipos, { nombre: '', color: '#808080' }]);
  const removeEquipo = (i: number) => setEquipos(equipos.filter((_, idx) => idx !== i));
  const updateEquipo = (i: number, field: keyof Equipo, value: string) => {
    const updated = [...equipos]; (updated[i] as any)[field] = value; setEquipos(updated);
  };

  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#FF5722', '#795548'];

  // Show form
  if (creating || editing) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center gap-4">
            <button onClick={() => { resetForm(); setEditing(null); setCreating(false); }}
              className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Volver
            </button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {editing ? `Editar: ${editing.nombre}` : 'Crear Nuevo Evento'}
            </h1>
          </div>
        </header>

        <main className="max-w-[900px] mx-auto p-6 space-y-6">
          {/* Basic info */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Información Básica</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre del evento *</label>
                <input type="text" value={nombre} onChange={e => { setNombre(e.target.value); if (!editing) setSlug(generateSlug(e.target.value)); }}
                  placeholder="Ej: Legacy Women 2026" className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Slug (URL) *</label>
                <input type="text" value={slug} onChange={e => setSlug(e.target.value)}
                  placeholder="legacy-women-2026" className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent font-mono"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Ministerio</label>
                <input type="text" value={ministerio} onChange={e => setMinisterio(e.target.value)}
                  placeholder="Ej: Mujeres, Jóvenes, Evangelismo" className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Descripción</label>
                <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Breve descripción del evento" className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
            </div>
          </div>

          {/* Event type toggles */}
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Configuración</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: '🆓 Evento gratuito', desc: 'Sin cobro, solo registro', value: esGratuito, onChange: (v: boolean) => { setEsGratuito(v); if (v) { setPrecioDefault(0); setUsaFasesPrecio(false); setTieneAsientos(false); } } },
                { label: '🪑 Asientos enumerados', desc: 'Mapa de asientos con selección', value: tieneAsientos, onChange: (v: boolean) => { setTieneAsientos(v); if (v) setEsGratuito(false); } },
                { label: '📅 Fases de precio', desc: 'Precio varía por mes/fecha', value: usaFasesPrecio, onChange: (v: boolean) => { setUsaFasesPrecio(v); if (v) setEsGratuito(false); } },
                { label: '👥 Equipos', desc: 'Usa equipos en vez de naciones', value: usaEquipos, onChange: setUsaEquipos },
              ].map(toggle => (
                <button key={toggle.label} onClick={() => toggle.onChange(!toggle.value)}
                  className={`text-left px-4 py-3 rounded-lg border transition-all ${toggle.value ? 'border-cyan-500' : 'border-slate-700'}`}
                  style={toggle.value ? { background: 'rgba(0,188,212,0.1)' } : {}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{toggle.label}</span>
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${toggle.value ? 'bg-cyan-500 text-white' : 'border border-slate-600'}`}>
                      {toggle.value ? '✓' : ''}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{toggle.desc}</p>
                </button>
              ))}
            </div>

            {/* Precio default (if not free and not phases) */}
            {!esGratuito && !usaFasesPrecio && (
              <div className="mt-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Precio del boleto</label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input type="number" value={precioDefault} onChange={e => setPrecioDefault(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm border bg-transparent"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                </div>
              </div>
            )}
          </div>

          {/* Fases de precio */}
          {usaFasesPrecio && (
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Fases de Precio</h3>
                <button onClick={addFase} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: 'var(--color-accent)' }}>+ Agregar Fase</button>
              </div>
              <div className="space-y-3">
                {fases.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr_1fr_40px] gap-2 items-end">
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Nombre</label>
                      <input type="text" value={f.nombre} onChange={e => updateFase(i, 'nombre', e.target.value)} placeholder="Ej: Preventa"
                        className="w-full px-2 py-2 rounded text-xs border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Precio</label>
                      <input type="number" value={f.precio} onChange={e => updateFase(i, 'precio', Number(e.target.value))}
                        className="w-full px-2 py-2 rounded text-xs border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Desde</label>
                      <input type="date" value={f.fecha_inicio} onChange={e => updateFase(i, 'fecha_inicio', e.target.value)}
                        className="w-full px-2 py-2 rounded text-xs border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Hasta</label>
                      <input type="date" value={f.fecha_fin} onChange={e => updateFase(i, 'fecha_fin', e.target.value)}
                        className="w-full px-2 py-2 rounded text-xs border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    </div>
                    <button onClick={() => removeFase(i)} className="px-2 py-2 rounded text-xs hover:text-red-400" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                  </div>
                ))}
                {fases.length === 0 && <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Sin fases — agrega una</p>}
              </div>
            </div>
          )}

          {/* Equipos */}
          {usaEquipos && (
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Equipos</h3>
                <button onClick={addEquipo} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: 'var(--color-accent)' }}>+ Agregar Equipo</button>
              </div>
              <div className="space-y-2">
                {equipos.map((eq, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="color" value={eq.color} onChange={e => updateEquipo(i, 'color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input type="text" value={eq.nombre} onChange={e => updateEquipo(i, 'nombre', e.target.value)} placeholder="Nombre del equipo"
                      className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    <button onClick={() => removeEquipo(i)} className="px-2 py-2 rounded text-xs hover:text-red-400" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                  </div>
                ))}
                {equipos.length === 0 && <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Sin equipos — agrega uno</p>}
              </div>
            </div>
          )}

          {/* Errors / Success */}
          {formError && <div className="rounded-lg p-3 text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{formError}</div>}
          {formSuccess && <div className="rounded-lg p-3 text-sm text-center" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{formSuccess}</div>}

          <button onClick={handleSave} disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}>
            {loading ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Evento'}
          </button>
        </main>
      </div>
    );
  }

  // Event list
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Volver
            </button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>🎫 Gestionar Eventos</h1>
          </div>
          <button onClick={() => { resetForm(); setCreating(true); }}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            + Crear Evento
          </button>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto p-6 space-y-4">
        {eventos.map(e => {
          const fecha = e.fecha ? new Date(e.fecha + 'T12:00:00') : null;
          return (
            <div key={e.id} className="rounded-xl p-5 border flex items-center justify-between"
              style={{ background: 'var(--color-surface)', borderColor: e.activo ? 'var(--color-border)' : 'rgba(239,68,68,0.3)', opacity: e.activo ? 1 : 0.6 }}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>{e.nombre}</h3>
                  {e.es_gratuito && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Gratuito</span>}
                  {e.tiene_asientos && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400">Asientos</span>}
                  {e.usa_fases_precio && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">Fases</span>}
                  {e.usa_equipos && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400">Equipos</span>}
                  {!e.activo && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">Inactivo</span>}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {fecha?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} · ${e.precio_default} · {e.slug}
                  {e.ministerio && ` · ${e.ministerio}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => loadEventForEdit(e)}
                  className="px-3 py-1.5 rounded-lg text-xs border hover:border-cyan-500"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>✏️ Editar</button>
                <button onClick={() => handleToggleActive(e.id, e.activo)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${e.activo ? 'hover:border-red-500 hover:text-red-400' : 'hover:border-emerald-500 hover:text-emerald-400'}`}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                  {e.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                </button>
              </div>
            </div>
          );
        })}
        {eventos.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>No hay eventos creados</div>
        )}
      </main>
    </div>
  );
}
