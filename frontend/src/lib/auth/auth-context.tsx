"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "../api/client";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("ds_token");
      if (storedToken) {
        setToken(storedToken);
        try {
          // Fetch current user details
          const userData = await apiClient<User>("/auth/me", {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(userData);
        } catch (error) {
          console.error("Auth init failed:", error);
          // Token might be expired or invalid
          localStorage.removeItem("ds_token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Auth Guard
  useEffect(() => {
    if (!loading) {
      if (!user && !PUBLIC_ROUTES.includes(pathname)) {
        router.push("/login");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (newToken: string) => {
    localStorage.setItem("ds_token", newToken);
    setToken(newToken);
    try {
      const userData = await apiClient<User>("/auth/me", {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      setUser(userData);
      router.push("/");
    } catch (error) {
      console.error("Failed to fetch user after login", error);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem("ds_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
