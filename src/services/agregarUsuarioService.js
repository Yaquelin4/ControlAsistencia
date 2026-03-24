// src/services/agregarUsuarioService.js
import { ref, get, child, push, runTransaction, update } from "firebase/database";
import { dbAsistencia as db } from "../firebase";

// Lee /managers completo
async function getManagersFromRTDB() {
  const root = ref(db);
  const snap = await get(child(root, "managers"));
  return snap.exists() ? snap.val() : {};
}

// (Opcional) Lee /location completo (oficinas)
async function getOfficesFromRTDB() {
  const root = ref(db);
  const snap = await get(child(root, "location"));
  return snap.exists() ? snap.val() : {};
}

// Contador atómico para UID/UUID
async function getNextIncrementalId() {
  const counterRef = ref(db, "counters/users");
  const result = await runTransaction(counterRef, (current) => {
    if (current == null || typeof current !== "number") return 1;
    return current + 1;
  });
  return result?.snapshot?.val() ?? 1;
}

// Limpia prefijo “Encargado(a) de ...”
function normalizeDesignation(raw) {
  if (!raw) return "";
  return String(raw).replace(/^Encargad[ao]\s+de\s*/i, "").trim();
}

// Entero entre 0..30
function toInt0_30(v) {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 30);
}

/* ============================
   Crear usuario SOLO en RTDB
============================ */
async function addUserToRTDB(payload = {}) {
  const {
    username,
    nombre,
    address,
    phoneNumber,
    managerKey,
    designation,
    allotted_office,
    leaves = {}, // { op, va, sc, pe, pa }
  } = payload;

  if (!username || !nombre) {
    throw new Error("username (correo) y nombre son requeridos");
  }

  // 1) UID / UUID
  const newId = await getNextIncrementalId();

  // 2) Resolver designación
  let resolvedDesignation = designation || "";
  if (!resolvedDesignation && managerKey) {
    try {
      const mSnap = await get(ref(db, `managers/${managerKey}`));
      if (mSnap.exists()) {
        const raw = mSnap.val()?.designation ?? "";
        resolvedDesignation = normalizeDesignation(raw);
      }
    } catch {
      resolvedDesignation = "";
    }
  }

  // 3) Normalizar leaves (op, va, sc, pe, pa)
  const leavesNorm = {
    op: toInt0_30(leaves.op ?? leaves.OP ?? 0),
    va: toInt0_30(leaves.va ?? leaves.VA ?? 0),
    sc: toInt0_30(leaves.sc ?? leaves.SC ?? 0),
    pe: toInt0_30(leaves.pe ?? leaves.PE ?? 0),
    pa: toInt0_30(leaves.pa ?? leaves.PA ?? 0), 
  };

  // 4) Usuario
  const userData = {
    Name: nombre || "",
    Address: address || "",
    PhoneNumber: phoneNumber || "",
    UID: newId,
    UUID: newId,
    active: true,
    manager: managerKey || null,
    designation: resolvedDesignation || null,
    allotted_office: allotted_office || null,
    leaves: leavesNorm,
    notificationToken: "",
    username: username || "",
    createdAt: new Date().toISOString(),
  };

  // 5) Guardar
  const usersRef = ref(db, "users");
  const newRef = push(usersRef);

  const updates = {};
  updates[`/users/${newRef.key}`] = userData;
  updates[`/EmployeeID/${newId}`] = username || "";

  await update(ref(db), updates);

  return { id: newRef.key, ...userData };
}

/* ============================
   Listar usuarios
============================ */
async function listUsersFromRTDB() {
  const root = ref(db);
  const snap = await get(child(root, "users"));
  if (!snap.exists()) return [];

  const data = snap.val();
  return Object.keys(data).map((k) => {
    const u = data[k] || {};
    return {
      id: k,
      name: u.Name || "",
      username: u.username || "",
      createdAt: u.createdAt || null,
      active: typeof u.active === "boolean" ? u.active : true,
      manager: u.manager || null,
      designation: u.designation || null,
      allotted_office: u.allotted_office || null,
      leaves: {
        op: toInt0_30(u?.leaves?.op ?? 0),
        va: toInt0_30(u?.leaves?.va ?? 0),
        sc: toInt0_30(u?.leaves?.sc ?? 0),
        pe: toInt0_30(u?.leaves?.pe ?? 0),
        pa: toInt0_30(u?.leaves?.pa ?? 0), 
      },
      UID: u.UID ?? null,
      UUID: u.UUID ?? null,
    };
  });
}

/* ============================
   Toggle activo
============================ */
async function updateUserStatusRTDB(id, active) {
  await update(ref(db, `users/${id}`), { active: !!active });
  return { id, active: !!active };
}

/* ============================
   API Pública
============================ */
const AgregarUsuarioService = {
  async listManagers() {
    return await getManagersFromRTDB();
  },

  async listOffices() {
    return await getOfficesFromRTDB();
  },

  async addUser(payload) {
    if (!payload || !payload.username || !payload.nombre) {
      throw new Error("username (correo) y nombre son requeridos");
    }
    return await addUserToRTDB(payload);
  },

  async listUsers() {
    return await listUsersFromRTDB();
  },

  async updateUserStatus(id, active) {
    return await updateUserStatusRTDB(id, active);
  },
};

export default AgregarUsuarioService;
