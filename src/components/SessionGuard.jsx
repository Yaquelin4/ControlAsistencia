// src/components/SessionGuard.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/loginContext";

// Configuración de tiempos
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;      // 20 minutos
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;  // 12 horas
const CHECK_INTERVAL_MS = 60 * 1000;         // revisar cada 1 minuto

// Claves en localStorage (separadas de tu STORAGE_KEY actual)
const LS_LOGIN_TIME = "session_loginTime";
const LS_LOGIN_DAY = "session_loginDay";
const LS_LAST_ACTIVITY = "session_lastActivity";

// Eventos que vamos a considerar como "actividad"
const ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
];

export default function SessionGuard({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Si NO hay usuario autenticado: limpia llaves de sesión y no hace nada más
    if (!user) {
      try {
        localStorage.removeItem(LS_LOGIN_TIME);
        localStorage.removeItem(LS_LOGIN_DAY);
        localStorage.removeItem(LS_LAST_ACTIVITY);
      } catch (e) {
        console.warn("[SessionGuard] Error limpiando localStorage sin usuario:", e);
      }
      return; // sin usuario no arrancamos timers
    }

    // Si hay usuario autenticado:
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (!localStorage.getItem(LS_LOGIN_TIME)) {
        localStorage.setItem(LS_LOGIN_TIME, String(now));
      }
      if (!localStorage.getItem(LS_LOGIN_DAY)) {
        localStorage.setItem(LS_LOGIN_DAY, today);
      }
      if (!localStorage.getItem(LS_LAST_ACTIVITY)) {
        localStorage.setItem(LS_LAST_ACTIVITY, String(now));
      }
    } catch (e) {
      console.warn("[SessionGuard] No se pudo escribir en localStorage:", e);
    }

    const updateActivity = () => {
      try {
        localStorage.setItem(LS_LAST_ACTIVITY, String(Date.now()));
      } catch (e) {
        console.warn("[SessionGuard] No se pudo actualizar lastActivity:", e);
      }
    };

    // Escuchamos actividad del usuario
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, updateActivity)
    );

    // Intervalo para revisar expiración
    const intervalId = setInterval(async () => {
      try {
        const current = Date.now();
        const loginTime =
          parseInt(localStorage.getItem(LS_LOGIN_TIME) || `${current}`, 10) ||
          current;
        const lastActivity =
          parseInt(localStorage.getItem(LS_LAST_ACTIVITY) || `${current}`, 10) ||
          current;
        const loginDay = localStorage.getItem(LS_LOGIN_DAY) || today;
        const todayNow = new Date().toISOString().slice(0, 10);

        const idleElapsed = current - lastActivity;  // tiempo sin actividad
        const sessionElapsed = current - loginTime;  // tiempo total de sesión

        const idleExpired = idleElapsed > IDLE_TIMEOUT_MS;
        const maxSessionHit = sessionElapsed > MAX_SESSION_MS;
        const dayChanged = loginDay !== todayNow;

        if (idleExpired || maxSessionHit || dayChanged) {
          console.log("[SessionGuard] Sesión expirada por:", {
            idleExpired,
            maxSessionHit,
            dayChanged,
          });

          // Dejamos de escuchar actividad y paramos el interval
          ACTIVITY_EVENTS.forEach((ev) =>
            window.removeEventListener(ev, updateActivity)
          );
          clearInterval(intervalId);

          // Limpiamos las llaves de sesión
          try {
            localStorage.removeItem(LS_LOGIN_TIME);
            localStorage.removeItem(LS_LOGIN_DAY);
            localStorage.removeItem(LS_LAST_ACTIVITY);
          } catch (e) {
            console.warn("[SessionGuard] Error limpiando localStorage:", e);
          }

          try {
            // Cerramos sesión usando tu contexto (esto ya borra STORAGE_KEY y Firebase si aplica)
            await logout();
          } catch (e) {
            console.error("[SessionGuard] Error al llamar logout():", e);
          }

          // Enviamos al login con un motivo
          navigate("/login?reason=sesion_expirada", { replace: true });
        }
      } catch (e) {
        console.error("[SessionGuard] Error en chequeo de sesión:", e);
      }
    }, CHECK_INTERVAL_MS);

    // Cleanup cuando el componente se desmonte o cambie el usuario
    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, updateActivity)
      );
      clearInterval(intervalId);
    };
  }, [user, logout, navigate]);

  return children;
}
