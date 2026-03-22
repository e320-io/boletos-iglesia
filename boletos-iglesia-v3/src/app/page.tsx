'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import LoginScreen from '@/components/LoginScreen';
import EventHome from '@/components/EventHome';
import AdminPanel from '@/components/AdminPanel';
import EventManager from '@/components/EventManager';

interface Evento {
  id: string;
  nombre: string;
  slug: string;
  fecha: string;
  descripcion: string;
  precio_default: number;
  tiene_asientos: boolean;
  activo: boolean;
}

export default function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showEventManager, setShowEventManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('eventos').select('*').eq('activo', true).order('fecha');
      if (data) {
        setEventos(data);
        // Auto-select event for evento-specific users
        if (user && (user.rol === 'evento' || (user.rol === 'dueno' && user.evento_id)) && user.evento_id) {
          const assigned = data.find((e: any) => e.id === user.evento_id);
          if (assigned) setSelectedEvento(assigned);
        }
      }
      setLoading(false);
    }
    load();
  }, [user]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>✦</div>
          <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  // Not logged in — show login
  if (!user) {
    return <LoginScreen />;
  }

  // Admin panel
  if (showAdmin && user.rol === 'admin') {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  // Event manager
  if (showEventManager && user.rol === 'admin') {
    return <EventManager onBack={() => { setShowEventManager(false); /* Reload events */ setLoading(true); supabase.from('eventos').select('*').eq('activo', true).order('fecha').then(({ data }) => { if (data) setEventos(data); setLoading(false); }); }} />;
  }

  // Inside an event
  if (selectedEvento) {
    return <EventHome evento={selectedEvento}
      onBack={(user.rol === 'evento' || (user.rol === 'dueno' && user.evento_id)) ? () => logout() : () => setSelectedEvento(null)}
      userRole={user.rol} />;
  }

  // Event selector
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            ✦
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Sistema de Registro
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Hola, <strong>{user.nombre}</strong> — {user.rol === 'admin' ? 'Administrador' : user.rol === 'dueno' ? 'Dueño del evento' : 'Registro'}
          </p>
        </div>

        <div className="grid gap-4">
          {eventos.map(e => {
            const fecha = new Date(e.fecha + 'T12:00:00');
            const hoy = new Date();
            const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
            const esHoy = diff === 0;

            return (
              <button
                key={e.id}
                onClick={() => setSelectedEvento(e)}
                className="w-full text-left rounded-xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg group"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: esHoy ? 'var(--color-accent)' : 'var(--color-border)',
                  boxShadow: esHoy ? '0 0 20px rgba(0, 188, 212, 0.15)' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                        {e.nombre}
                      </h2>
                      {esHoy && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white animate-pulse"
                          style={{ background: 'var(--color-accent)' }}>HOY</span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {e.descripcion} · {fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {diff > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-accent)' }}>Faltan {diff} días</p>
                    )}
                  </div>
                  <div className="text-2xl opacity-30 group-hover:opacity-70 transition-opacity">→</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {user.rol === 'admin' && (
            <div className="flex gap-2">
              <button onClick={() => setShowAdmin(true)}
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:border-cyan-500"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                ⚙️ Usuarios
              </button>
              <button onClick={() => setShowEventManager(true)}
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:border-cyan-500"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                🎫 Eventos
              </button>
            </div>
          )}
          <div className="flex-1" />
          <button onClick={logout}
            className="px-4 py-2 rounded-lg text-sm border transition-all hover:border-red-500 hover:text-red-400"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
