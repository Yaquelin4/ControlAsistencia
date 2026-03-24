// src/contexts/loginContext.jsx
// Autenticación y autorización basadas en RTDB /EmployeeID.
// Solo tienen acceso los correos que estén dentro de EmployeeID/hr.
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  signInWithGooglePopup,
  signOut as firebaseSignOut,
  dbAsistencia,
  signInWithEmailPass,
} from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";

const LoginContext = createContext(null);
export const useAuth = () => useContext(LoginContext);

const STORAGE_KEY = "myapp_user_manual";
const NOT_ALLOWED_MSG =
  "ESTE USUARIO NO ESTÁ HABILITADO PARA USAR EL PANEL WEB DE ASISTENCIA";

function mapHrKeyToRole(hrKey) {
  if (!hrKey) {
    return { role: "basic", managerCode: null, employeeId: null };
  }

  if (hrKey === "0") {
    return {
      role: "admin",
      managerCode: null,
      employeeId: 0,
    };
  }

  const n = parseInt(hrKey, 10);
  if (Number.isFinite(n)) {
    return {
      role: "manager",
      managerCode: `manager${n}`,
      employeeId: n,
    };
  }

  return { role: "basic", managerCode: null, employeeId: null };
}

async function getRoleInfoFromEmployeeID(emailLower) {
  const snap = await get(ref(dbAsistencia, "EmployeeID"));
  if (!snap.exists()) {
    throw new Error(NOT_ALLOWED_MSG);
  }

  const data = snap.val() || {};
  const hrNode = data.hr || {};
  const vsNode = data.vs || {};

  for (const [subKey, subVal] of Object.entries(hrNode)) {
    if (typeof subVal === "string") {
      const stored = subVal.trim().toLowerCase();
      if (stored === emailLower) {
        const mapped = mapHrKeyToRole(subKey);
        return {
          role: mapped.role,
          managerCode: mapped.managerCode,
          employeeId: mapped.employeeId,
          hrKey: subKey,
          scope: "hr",
          vsKey: null,
        };
      }
    }
  }

  for (const [subKey, subVal] of Object.entries(vsNode)) {
    if (typeof subVal === "string") {
      const stored = subVal.trim().toLowerCase();
      if (stored === emailLower) {
        return {
          role: "viewer",
          managerCode: null,
          employeeId: null,
          hrKey: null,
          scope: "vs",
          vsKey: subKey,
        };
      }
    }
  }

  throw new Error(NOT_ALLOWED_MSG);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      let storedUser = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        storedUser = raw ? JSON.parse(raw) : null;
      } catch {}

      try {
        if (!firebaseUser) {
          if (storedUser) {
            setUser(storedUser);
            setAuthError(null);
            setInitializing(false);
            return;
          }

          setUser(null);
          setAuthError(null);
          setInitializing(false);
          return;
        }

        const emailLower = (firebaseUser.email || "").trim().toLowerCase();
        if (!emailLower) {
          await firebaseSignOut().catch(() => {});
          setUser(null);
          setAuthError(NOT_ALLOWED_MSG);
          setInitializing(false);
          return;
        }

        const roleInfo = await getRoleInfoFromEmployeeID(emailLower);

        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL || null,
          provider: firebaseUser.providerData?.[0]?.providerId || "firebase",
          role: roleInfo.role,
          managerCode: roleInfo.managerCode,
          employeeId: roleInfo.employeeId,
          hrKey: roleInfo.hrKey,
          scope: roleInfo.scope,
          vsKey: roleInfo.vsKey,
        };

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        } catch {}

        setUser(userData);
        setAuthError(null);
      } catch (err) {
        await firebaseSignOut().catch(() => {});
        setUser(null);
        setAuthError(err?.message || NOT_ALLOWED_MSG);
      } finally {
        setInitializing(false);
      }
    });

    return () => unsub();
  }, []);

  const manualLogin = async (emailInput, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const rawEmail = (emailInput || "").trim();
      const emailLower = rawEmail.toLowerCase();

      if (!rawEmail) throw new Error("Ingresa un email.");
      if (!password) throw new Error("Ingresa una contraseña.");

      const fbUser = await signInWithEmailPass(rawEmail, password);

      try {
        await getRoleInfoFromEmployeeID(emailLower);
      } catch (authzErr) {
        await firebaseSignOut().catch(() => {});
        throw authzErr;
      }

      return fbUser;
    } catch (err) {
      const code = err?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-login-credentials"
      ) {
        setAuthError("Credenciales incorrectas.");
      } else {
        setAuthError(err?.message || NOT_ALLOWED_MSG);
      }
      throw err;
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const fbResult = await signInWithGooglePopup();
      return fbResult;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      try {
        await firebaseSignOut();
      } catch {}
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setUser(null);
      setAuthError(null);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  const value = {
    user,
    loading,
    initializing,
    authError,
    manualLogin,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    role: user?.role || "basic",
    managerCode: user?.managerCode || null,
    employeeId: user?.employeeId ?? null,
    hrKey: user?.hrKey ?? null,
    scope: user?.scope || null,
    vsKey: user?.vsKey ?? null,
  };

  return (
    <LoginContext.Provider value={value}>
      {!initializing && children}
    </LoginContext.Provider>
  );
}
