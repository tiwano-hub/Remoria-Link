import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken } from './api/client';
import { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  devLogin: (email: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/google', { credential });
    setToken(res.token);
    setUser(res.user);
  };

  const devLogin = async (email: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/dev-login', { email });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, loginWithGoogle, devLogin, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
