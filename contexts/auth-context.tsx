"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import {
  clearSession,
  loadSession,
  saveSession,
  type SessionPayload,
} from "@/lib/session-storage";
import type { User } from "@/lib/types/api";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Hidratar sessão do localStorage após montar (evita mismatch SSR/cliente com JWT).
  /* eslint-disable react-hooks/set-state-in-effect -- hidratação única pós-mount */
  useEffect(() => {
    setUser(loadSession()?.user ?? null);
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const payload: SessionPayload = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
    };
    saveSession(payload);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await usersApi.getProfile();
    const s = loadSession();
    if (s) {
      saveSession({ ...s, user: u });
    }
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser }),
    [user, ready, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
