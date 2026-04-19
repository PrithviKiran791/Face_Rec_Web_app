"use client";
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";

interface User {
  username: string;
  name: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount — check if the httpOnly cookie session is still valid.
  // Mirrors streamlit-authenticator's cookie check on every page load.
  useEffect(() => {
    api
      .get("/api/auth/me", { withCredentials: true })
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const r = await api.post(
        "/api/auth/login",
        { username, password },
        { withCredentials: true } // ← sends/receives the httpOnly cookie
      );
      
      // Save token for Bearer authentication
      if (r.data.access_token) {
        localStorage.setItem("attendance_token", r.data.access_token);
      }
      
      setUser({ username: r.data.username, name: r.data.name });
      return null; // null = no error
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        return e.response.data.detail;
      }
      return "Login failed. Please check your credentials.";
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } finally {
      localStorage.removeItem("attendance_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
