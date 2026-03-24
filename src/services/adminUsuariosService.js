// src/services/adminUsuariosService.js
import { ref, set, runTransaction, get } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signOut as authSignOut,
} from "firebase/auth";
import { dbAsistencia, adminAuth } from "../firebase";
import { obtenerSiguienteUID } from "./contadorUIDService";

/** Convierte a entero entre 0 y 30 */
function clamp0_30(v) {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 30);
}

/**
 * Crea un usuario completo:
 *  - Auth (email+password)
 *  - users/{authUid} con {
 *      Address, Name, PhoneNumber, UID, UUID(DNI), active, manager,
 *      allotted_office?, designation, Email,
 *      leaves { op, va, sc, pe }
 *    }
 *  - EmployeeID/{UID} = email
 */
export async function crearUsuarioCompleto(payload) {
  const {
    UUID, // DNI (8 dígitos)
    Name,
    Email,
    Password,
    PhoneNumber = "",
    Address = "",
    manager = "",
    allotted_office,
    active = true,
    leaves = {},
    designation, // por si quieres pasarla desde el modal
  } = payload || {};

  if (!Name || !Email || !Password) {
    throw new Error("Name, Email y Password son requeridos.");
  }

  const dni = String(UUID ?? "").trim();
  if (!/^\d{8}$/.test(dni)) {
    throw new Error("UUID (DNI) debe tener 8 dígitos.");
  }

  const emailNorm = String(Email).trim().toLowerCase();

  // 1) Crear usuario en Auth secundaria (no cierra tu sesión principal)
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(adminAuth, emailNorm, Password);
  } catch (e) {
    // Errores típicos: auth/email-already-in-use, auth/invalid-email, auth/weak-password
    throw e;
  } finally {
    // Importante: limpiar sesión del "adminAuth" para que no quede logueado
    try {
      await authSignOut(adminAuth);
    } catch {
      // no pasa nada si falla
    }
  }

  const authUid = cred.user.uid;

  // 2) Obtener UID secuencial (interno)
  const nextUID = await obtenerSiguienteUID();

  // 3) Leer la designación desde /managers/{manager} y limpiar "Encargado(a) de"
  let resolvedDesignation = designation || "";
  if (!resolvedDesignation && manager) {
    try {
      const mSnap = await get(ref(dbAsistencia, `managers/${manager}`));
      if (mSnap.exists()) {
        const raw = (mSnap.val()?.designation ?? "").toString();
        resolvedDesignation = raw.replace(/^Encargad[ao]\s+de\s*/i, "").trim();
      }
    } catch {
      resolvedDesignation = "";
    }
  }

  // 4) Normalizar leaves desde el payload (si no viene nada -> 0)
  const leavesNorm = {
    op: clamp0_30(leaves.op ?? leaves.OP ?? 0),
    va: clamp0_30(leaves.va ?? leaves.VA ?? 0),
    sc: clamp0_30(leaves.sc ?? leaves.SC ?? 0),
    pe: clamp0_30(leaves.pe ?? leaves.PE ?? 0),
    pa: clamp0_30(leaves.pa ?? leaves.PA ?? 0),
  };

  // 5) Armar objeto de usuario (ahora incluye Email)
  const userData = {
    Address,
    Name,
    Email: emailNorm, // <-- CLAVE: lo guardamos para poder buscar/validar luego
    PhoneNumber,
    UID: nextUID,
    UUID: dni, // DNI
    active: !!active,
    manager: manager || "",
    leaves: leavesNorm,
  };
  if (allotted_office) userData.allotted_office = allotted_office;
  if (resolvedDesignation) userData.designation = resolvedDesignation;

  // 6) Guardar en RTDB
  await set(ref(dbAsistencia, `users/${authUid}`), userData);

  // 7) Registrar EmployeeID/{nextUID} = Email
  await set(ref(dbAsistencia, `EmployeeID/${nextUID}`), emailNorm);

  // 8) Contador de usuarios (se mantiene como lo tenías)
  await runTransaction(ref(dbAsistencia, "counters/users"), (current) => {
    const cur = Number(current);
    return Number.isFinite(cur) && cur >= 0 ? cur + 1 : 1;
  });

  return { authUid, UID: nextUID, data: userData };
}

/** Activar / desactivar usuario */
export async function cambiarEstadoUsuario(authUid, active) {
  await set(ref(dbAsistencia, `users/${authUid}/active`), !!active);
  return { id: authUid, active: !!active };
}
