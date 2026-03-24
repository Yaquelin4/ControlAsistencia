// src/components/Layout/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/loginContext";

export default function ProtectedRoute({
  children,
  allowedRoles = null,     // ej: ["admin"] o ["admin","manager"]
  redirectTo = "/dashboard",
}) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  // 1) Si NO está autenticado → login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2) Si NO hay restricción de roles → pasa (admin/manager)
  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  // 3) Si hay restricción y el rol no está permitido → redirigir
  const hasAccess = allowedRoles.includes(role);

  if (!hasAccess) {
    // (Opcional) Alert solo si estás en navegador
    if (typeof window !== "undefined") {
      window.alert("ESTA PARTE ES SOLO PARA ADMINISTRADORES");
    }
    return <Navigate to={redirectTo} replace />;
  }

  // 4) Permitido
  return children;
}
