"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { apiGetMe, apiLogin, apiRegister } from "@/lib/api";
import type { UserCreate, UserPublic } from "@/lib/types";

type AuthContextValue = {
  token: string | null;
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: UserCreate) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const TOKEN_KEY = "pure-review-token";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);

    apiGetMe(stored)
      .then((me) => {
        setUser(me);
      })
      .catch((err) => {
        console.warn("自動ログイン失敗（トークン期限切れなど）:", err);

        // 無効なトークンをブラウザから削除
        localStorage.removeItem(TOKEN_KEY);

        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const refreshMe = async () => {
    if (!token) return;
    const me = await apiGetMe(token);
    setUser(me);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const nextToken = await apiLogin(email, password);
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      const me = await apiGetMe(nextToken);
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: UserCreate) => {
    setLoading(true);
    try {
      await apiRegister(payload);
      await login(payload.email, payload.password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
