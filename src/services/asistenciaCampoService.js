// src/services/asistenciaCampoService.js
import { ref, get, child, set } from "firebase/database";
import { dbAsistencia as dbCampo } from "../firebase";

export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
};

function normalizeStatus(s) {
  const t = String(s || "").trim().toLowerCase();
  if (t === "approved" || t === "approve" || t === "aprobado") return STATUS.APPROVED;
  if (t === "denied" || t === "rejected" || t === "reject" || t === "rechazado")
    return STATUS.DENIED;
  return STATUS.PENDING;
}

const TYPE_LABELS = {
  op: "Olvidé picar",
  va: "Vacaciones",
  sc: "Comisión de servicio",
  pe: "Permiso ocasional",
  pa: "Permiso personal",
};

const LEGACY_TYPE_TO_NEW = {
  al: "op",
  cl: "va",
  ml: "pe",
};

function normalizeType(typeRaw) {
  const t = String(typeRaw || "").trim().toLowerCase();
  if (TYPE_LABELS[t]) return t;
  if (LEGACY_TYPE_TO_NEW[t]) return LEGACY_TYPE_TO_NEW[t];
  return t;
}

function parseDMY(dmy) {
  if (!dmy) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dmy).trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isFinite(d.getTime()) ? d : null;
}

function monthFromDMY(dmy) {
  const d = parseDMY(dmy);
  return d ? d.getMonth() + 1 : null;
}

function yearFromDMY(dmy) {
  const d = parseDMY(dmy);
  return d ? d.getFullYear() : null;
}

export function fmtFechaCorta(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function tsFromAppliedDateOrFallback(appliedDate, fromDate) {
  const d1 = parseDMY(appliedDate);
  if (d1) {
    d1.setHours(0, 0, 0, 0);
    const ts1 = d1.getTime();
    return Number.isFinite(ts1) ? ts1 : 0;
  }
  const d2 = parseDMY(fromDate);
  if (!d2) return 0;
  d2.setHours(0, 0, 0, 0);
  const ts2 = d2.getTime();
  return Number.isFinite(ts2) ? ts2 : 0;
}

async function fetchAllLeaves() {
  const root = ref(dbCampo);

  const [leavesSnap, usersSnap, managersSnap] = await Promise.all([
    get(child(root, "leaves")),
    get(child(root, "users")),
    get(child(root, "managers")),
  ]);

  const leaves = leavesSnap.exists() ? leavesSnap.val() : {};
  const users = usersSnap.exists() ? usersSnap.val() : {};
  const managers = managersSnap.exists() ? managersSnap.val() : {};

  const rows = [];

  Object.entries(leaves).forEach(([userId, userLeaves]) => {
    const u = users[userId] || {};
    const usuario = u.Name || userId;
    const userManagerCode = u.manager || null;

    const responsable =
      userManagerCode && managers[userManagerCode]?.name ? managers[userManagerCode].name : "";

    Object.entries(userLeaves || {}).forEach(([leaveId, leave]) => {
      const withdrawal = Number(leave?.withdrawalStatus ?? 0);

      const appliedDate = leave?.appliedDate || "";
      const fromDate = leave?.fromDate;
      const toDate = leave?.toDate;

      const baseDateForFilter =
        appliedDate && parseDMY(appliedDate) ? appliedDate : fromDate;

      const mes = monthFromDMY(baseDateForFilter);
      const year = yearFromDMY(baseDateForFilter);

      const type = normalizeType(leave?.type);
      const tipoKey = type;
      const tipoPermiso = TYPE_LABELS[type] || String(type || "").toUpperCase();

      const rawMsg = String(leave?.message ?? "").trim();
      const justificacion =
        !rawMsg || rawMsg.toLowerCase() === "none" ? "Ninguna" : rawMsg;

      const estado = normalizeStatus(leave?.status);

      rows.push({
        id: `${userId}__${leaveId}`,
        userId,
        leaveId,
        usuario,
        responsable,
        mes,
        year,
        appliedDate,
        desde: parseDMY(fromDate),
        hasta: parseDMY(toDate),
        tipoPermiso,
        tipoKey,
        justificacion,
        estado,
        withdrawalStatus: withdrawal,
        managerCode: userManagerCode,
      });
    });
  });

  return rows;
}

export async function fetchAsistenciaAll() {
  return await fetchAllLeaves();
}

export async function fetchAsistenciaByRange(fromDate, toDate) {
  const all = await fetchAllLeaves();

  const from = fromDate instanceof Date ? new Date(fromDate) : new Date(fromDate);
  const to = toDate instanceof Date ? new Date(toDate) : new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return all;

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const fromTS = from.getTime();
  const toTS = to.getTime();

  return all.filter((r) => {
    const ts = tsFromAppliedDateOrFallback(r.appliedDate, r.desde ? toDMY(r.desde) : null);
    if (!ts) {
      const ts2 = tsFromAppliedDateOrFallback(r.appliedDate, r?.rawFromDate);
      return ts2 ? ts2 >= fromTS && ts2 <= toTS : false;
    }
    return ts >= fromTS && ts <= toTS;
  });
}

export async function fetchAsistenciaByMonth(month = null) {
  const all = await fetchAllLeaves();
  if (month == null) return all;
  const m = Number(month);
  if (m === 0) return all;
  return all.filter((r) => r.mes === m);
}

export async function fetchAsistenciaByMonthYear(month, year) {
  const all = await fetchAllLeaves();
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y)) return all;
  if (m === 0) return all.filter((r) => r.year === y);
  return all.filter((r) => r.mes === m && r.year === y);
}

export async function updateLeaveStatus(userId, leaveId, newStatus) {
  const allowed = new Set([STATUS.PENDING, STATUS.APPROVED, STATUS.DENIED]);
  const finalStatus = allowed.has(newStatus) ? newStatus : STATUS.PENDING;
  const statusRef = ref(dbCampo, `leaves/${userId}/${leaveId}/status`);
  await set(statusRef, finalStatus);
  return finalStatus;
}

function toDMY(dateObj) {
  if (!dateObj) return null;
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
