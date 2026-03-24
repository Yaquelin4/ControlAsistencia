// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // renombrado a "user" para que sea intuitivo (ProtectedRoute espera user)
  const [user, setUser] = useState(() => authService.current?.() ?? null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); // true hasta saber el estado inicial

  useEffect(() => {
    let unsub = null;
    // Si authService provee una suscripción tipo onAuthStateChanged, la usamos
    // (esto es típico si authService es un wrapper de Firebase Auth)
    if (typeof authService.onAuthStateChanged === "function") {
      unsub = authService.onAuthStateChanged((u) => {
        setUser(u ?? null);
        setInitializing(false);
      });
    } else {
      // Fallback: usamos el valor actual y escuchamos storage (tu enfoque previo)
      try {
        const current = authService.current?.() ?? null;
        setUser(current);
      } catch (err) {
        setUser(null);
      } finally {
        setInitializing(false);
      }

      // Mantener el storage listener para sincronizar entre pestañas
      const onStorage = () => {
        try {
          setUser(authService.current?.() ?? null);
        } catch {
          setUser(null);
        }
      };
      window.addEventListener("storage", onStorage);
      // guardamos una función de limpieza combinada
      unsub = () => window.removeEventListener("storage", onStorage);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // login usando authService
  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await authService.login(username, password);
      // authService.login puede devolver el user o un token; intenta normalizar
      const current = authService.current?.() ?? res ?? null;
      setUser(current);
      return res;
    } catch (err) {
      // re-lanzamos para que la UI lo maneje (ej. mostrar mensaje)
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // si authService.logout es async, lo esperamos
      await authService.logout?.();
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    initializing,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
