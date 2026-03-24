// src/pages/Login.jsx
// Renderiza la interfaz de inicio de sesión

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/loginContext";
import "../styles/loginAutentic.css";
import { FcGoogle } from "react-icons/fc";

export default function Login() {
  const navigate = useNavigate();
  const { manualLogin, loginWithGoogle, user, loading, role, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirección cuando ya hay usuario autenticado
  useEffect(() => {
    if (!user) return;

    console.log("[LOGIN] Usuario autenticado:", user.email, "role:", role);

    // Ahora TODOS (admin y manager) van primero al dashboard
    navigate("/dashboard", { replace: true });
  }, [user, role, navigate]);


  // Login manual (email/contraseña)
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setFormLoading(true);
    try {
      const normalizedEmail = (email || "").trim().toLowerCase();
      await manualLogin(normalizedEmail, password);
      // el useEffect hará la redirección
    } catch (err) {
      console.error("[LOGIN] Error en manualLogin:", err);
      setError(err?.message || "Error en el inicio de sesión");
    } finally {
      setFormLoading(false);
    }
  };

  // Login con Google
  const handleGoogle = async () => {
    setError(null);
    setFormLoading(true);
    try {
      await loginWithGoogle();
      // onAuthStateChanged + useEffect hacen el resto
    } catch (err) {
      console.error("[LOGIN] Error en loginWithGoogle:", err);
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user") {
        setError("Inicio de sesión cancelado. Intenta de nuevo.");
      } else if (code === "auth/popup-blocked") {
        setError(
          "El navegador bloqueó la ventana. Permite popups e inténtalo de nuevo."
        );
      } else if ((err?.message || "").includes("Correo no registrado")) {
        setError("Correo no registrado");
      } else {
        setError(err?.message || "Error en login con Google");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const isBusy = loading || formLoading;
  const visibleError = error || authError;

  return (
    <div className="auth-page">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          <h1>Control de asistencia en GPA</h1>
          <div className="role">Administrador / Manager</div>
          <div className="hint">Inicia sesión con Google o con tu cuenta</div>

          <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
            <input
              type="email"
              placeholder="correo@dominio.com"
              aria-label="usuario"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isBusy}
              autoComplete="email"
              required
            />

            <input
              type="password"
              placeholder="contraseña"
              aria-label="contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
              autoComplete="current-password"
              required
            />

            <button type="submit" className="auth-btn" disabled={isBusy}>
              {formLoading ? "Ingresando..." : "Iniciar sesión"}
            </button>

            <div className="divider">o continuar con</div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogle}
              disabled={isBusy}
            >
              <FcGoogle className="google-icon" />
              Iniciar sesión con Google
            </button>

            {visibleError && (
              <div style={{ color: "salmon", marginTop: 12 }}>
                {visibleError}
              </div>
            )}

            <div className="auth-legal" style={{ marginTop: 12 }}>
              Al hacer clic en Continuar aceptas nuestros <br />
              <strong>Términos de servicio</strong> y la{" "}
              <strong>Política de privacidad</strong>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
