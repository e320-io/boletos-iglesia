'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');

    const result = await login(username.trim(), password);

    if (!result.ok) {
      setError(result.error || 'Error de autenticación');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)' }}>
            ✦
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Sistema de Registro
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Inicia sesión para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl p-6 border space-y-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              autoComplete="username"
              autoFocus
              className="w-full px-4 py-3 rounded-lg text-sm border bg-transparent"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg text-sm border bg-transparent"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm text-center"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #0097a7)', fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
