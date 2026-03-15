'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ACTION_LABELS, logActivity } from '@/lib/activity';
import { useAuth } from '@/lib/auth';

interface Usuario {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  last_login: string | null;
  created_at: string;
}

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);

  // Activity log
  const [showLog, setShowLog] = useState(false);
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('todos');
  const [logLoading, setLogLoading] = useState(false);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newRol, setNewRol] = useState('registro');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Change password
  const [changingPwFor, setChangingPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('usuarios').select('id, username, nombre, rol, activo, last_login, created_at').order('created_at');
    if (data) setUsuarios(data);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    let query = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (logFilter !== 'todos') {
      query = query.eq('usuario_id', logFilter);
    }
    const { data } = await query;
    if (data) setLogEntries(data);
    setLogLoading(false);
  }, [logFilter]);

  useEffect(() => { if (showLog) fetchLog(); }, [showLog, fetchLog]);

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword || !newNombre.trim()) {
      setFormError('Todos los campos son requeridos');
      return;
    }
    if (newPassword.length < 4) {
      setFormError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      const { error } = await supabase.rpc('create_user', {
        p_username: newUsername.toLowerCase().trim(),
        p_password: newPassword,
        p_nombre: newNombre.trim(),
        p_rol: newRol,
      });
      if (error) throw error;

      setFormSuccess(`Usuario "${newUsername}" creado`);
      if (user) {
        await logActivity({ userId: user.id, userName: user.nombre, action: 'usuario_creado', detail: `${newNombre.trim()} (${newUsername.toLowerCase().trim()}) — ${newRol}` });
      }
      setNewUsername(''); setNewPassword(''); setNewNombre(''); setNewRol('registro');
      setTimeout(() => { setFormSuccess(''); setShowForm(false); }, 2000);
      fetchUsers();
    } catch (error: any) {
      setFormError(error.message?.includes('unique') ? 'Ese nombre de usuario ya existe' : error.message);
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await supabase.from('usuarios').update({ activo: !currentActive }).eq('id', userId);
    fetchUsers();
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPw || newPw.length < 4) return;
    setLoading(true);
    try {
      await supabase.rpc('change_password', { p_user_id: userId, p_new_password: newPw });
      setChangingPwFor(null);
      setNewPw('');
    } catch (error: any) {
      console.error(error);
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (username === 'admin') return; // Can't delete admin
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return;
    await supabase.from('usuarios').delete().eq('id', userId);
    fetchUsers();
  };

  const rolLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    registro: { label: 'Registro', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    dueno: { label: 'Dueño', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              ← Volver
            </button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              ⚙️ Administrar Usuarios
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <button onClick={() => setShowLog(false)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!showLog ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                style={!showLog ? { background: 'var(--color-accent)' } : {}}>
                👥 Usuarios
              </button>
              <button onClick={() => setShowLog(true)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${showLog ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                style={showLog ? { background: 'var(--color-accent)' } : {}}>
                📋 Actividad
              </button>
            </div>
            {!showLog && (
              <button onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
                + Crear Usuario
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto p-6 space-y-6">
        {!showLog ? (
          <>
        {/* Create user form */}
        {showForm && (
          <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-accent)', boxShadow: '0 0 20px rgba(0,188,212,0.1)' }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Nuevo Usuario</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre completo</label>
                <input type="text" value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre del usuario"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nombre de usuario</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="usuario123"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Contraseña</label>
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'registro', label: '📋 Registro', desc: 'Registra personas' },
                    { value: 'dueno', label: '👑 Dueño', desc: 'Solo dashboard' },
                    { value: 'admin', label: '⚙️ Admin', desc: 'Todo + usuarios' },
                  ].map(r => (
                    <button key={r.value} onClick={() => setNewRol(r.value)}
                      className={`px-2 py-2 rounded-lg text-xs border transition-all text-center ${newRol === r.value ? 'border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                      style={newRol === r.value ? { background: 'rgba(0,188,212,0.15)' } : {}}>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] opacity-60">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg p-2 text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg p-2 text-sm text-center" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                {formSuccess}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Cancelar</button>
              <button onClick={handleCreate} disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
                {loading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        )}

        {/* Users list */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Usuario</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Nombre</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Rol</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Último login</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 font-medium">{u.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${rolLabels[u.rol]?.color || ''}`}>
                      {rolLabels[u.rol]?.label || u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {u.last_login
                      ? new Date(u.last_login).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActive(u.id, u.activo)}
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto text-sm font-bold transition-all ${
                        u.activo ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600 text-slate-600'}`}>
                      {u.activo ? '✓' : '✕'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {changingPwFor === u.id ? (
                        <div className="flex gap-1">
                          <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nueva contraseña"
                            className="w-32 px-2 py-1 rounded text-xs border bg-transparent"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                          <button onClick={() => handleChangePassword(u.id)}
                            className="px-2 py-1 rounded text-xs bg-emerald-500 text-white">✓</button>
                          <button onClick={() => { setChangingPwFor(null); setNewPw(''); }}
                            className="px-2 py-1 rounded text-xs" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setChangingPwFor(u.id)}
                            className="px-2 py-1 rounded text-xs border hover:border-amber-500"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>🔑</button>
                          {u.username !== 'admin' && (
                            <button onClick={() => handleDeleteUser(u.id, u.username)}
                              className="px-2 py-1 rounded text-xs border hover:border-red-500 hover:text-red-400"
                              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>🗑️</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Roles explanation */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>Roles del Sistema</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-bold text-cyan-400 mb-1">📋 Registro</div>
              <p style={{ color: 'var(--color-text-muted)' }}>Registra personas, cobra boletos, hace check-in y genera corte de caja.</p>
            </div>
            <div>
              <div className="font-bold text-amber-400 mb-1">👑 Dueño</div>
              <p style={{ color: 'var(--color-text-muted)' }}>Solo ve el Dashboard ejecutivo. No puede registrar ni modificar datos.</p>
            </div>
            <div>
              <div className="font-bold text-red-400 mb-1">⚙️ Admin</div>
              <p style={{ color: 'var(--color-text-muted)' }}>Todo lo de Registro + Dashboard + crear y administrar usuarios.</p>
            </div>
          </div>
        </div>
          </>
        ) : (
          <>
        {/* Activity Log */}
        <div className="flex items-center gap-4 mb-2">
          <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>Historial de Actividad</h3>
          <select value={logFilter} onChange={e => setLogFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
            <option value="todos">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
            ))}
          </select>
          <button onClick={fetchLog} className="px-3 py-1.5 rounded-lg text-xs border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            🔄 Actualizar
          </button>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {logLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</div>
          ) : logEntries.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Sin actividad registrada</div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {logEntries.map(entry => {
                const actionIcons: Record<string, string> = {
                  registro_creado: '📝',
                  registro_editado: '✏️',
                  registro_eliminado: '🗑️',
                  pago_registrado: '💰',
                  pago_grupo_liquidado: '💰',
                  asiento_asignado: '🪑',
                  checkin_dia1: '✅',
                  checkin_dia2: '🟠',
                  usuario_creado: '👤',
                  usuario_editado: '👤',
                  login: '🔑',
                };
                return (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-lg mt-0.5">{actionIcons[entry.accion] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.usuario_nombre}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(0,188,212,0.1)', color: 'var(--color-accent)' }}>
                          {(ACTION_LABELS as any)[entry.accion] || entry.accion}
                        </span>
                      </div>
                      {entry.detalle && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{entry.detalle}</p>
                      )}
                    </div>
                    <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(entry.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}{' '}
                      {new Date(entry.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
