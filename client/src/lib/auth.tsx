import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, tokenStore } from './api';
import { closeSocket } from './socket';
import type { ProfilePatch, SelfUser } from './types';

interface AuthResponse {
  token: string;
  user: SelfUser;
}

interface AuthContextValue {
  user: SelfUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (nick: string, email: string, password: string, avatar?: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SelfUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<{ user: SelfUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) tokenStore.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback(({ token, user }: AuthResponse) => {
    tokenStore.set(token);
    setUser(user);
  }, []);

  const login = useCallback(
    async (login: string, password: string) => {
      handleAuth(await api<AuthResponse>('/auth/login', { method: 'POST', body: { login, password } }));
    },
    [handleAuth],
  );

  const register = useCallback(
    async (nick: string, email: string, password: string, avatar?: string) => {
      handleAuth(await api<AuthResponse>('/auth/register', { method: 'POST', body: { nick, email, password, avatar } }));
    },
    [handleAuth],
  );

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const { user } = await api<{ user: SelfUser }>('/auth/me', { method: 'PATCH', body: patch });
    setUser(user);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    await api('/auth/password', { method: 'PATCH', body: { current, next } });
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    closeSocket();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, updateProfile, changePassword, logout }),
    [user, loading, login, register, updateProfile, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
