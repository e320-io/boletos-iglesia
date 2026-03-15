'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  nombre: string;
  rol: 'admin' | 'registro' | 'dueno';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function getSessionFromCookie(): User | null {
  try {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    if (!sessionCookie) return null;

    const token = sessionCookie.split('=')[1];
    if (!token) return null;

    const decoded = JSON.parse(atob(token));

    // Check expiry
    if (decoded.exp && decoded.exp < Date.now()) return null;

    return {
      id: decoded.id,
      username: decoded.username,
      nombre: decoded.nombre,
      rol: decoded.rol,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionUser = getSessionFromCookie();
    setUser(sessionUser);
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || 'Error de autenticación' };
      }

      setUser(data.user);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Error de conexión' };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
