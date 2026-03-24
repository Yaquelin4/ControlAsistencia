import { ref, get, child } from "firebase/database";
import { db as rtdb } from "../firebase";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const TYPE_LABELS = { al: "Licencia anual", cl: "Permiso ocasional", ml: "Permiso médico" };

function parseDMY(dmy) {
  if (!dmy) return null;
  const [dd, mm, yyyy] = dmy.split("-").map((x) => parseInt(x, 10));
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}
function monthFromDMY(dmy) {
  const d = parseDMY(dmy);
  return d ? d.getMonth() + 1 : null;
}
export function fmtFechaCorta(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const day = d.getDate();
  const mes = MESES[d.getMonth()];
  return `${day} ${mes}`;
}

export async function fetchAsistenciaByMonth(month = null) {
  const root = ref(rtdb);
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
    const managerKey = u.manager;
    const responsable = managerKey && managers[managerKey]?.name ? managers[managerKey].name : "";

    Object.entries(userLeaves).forEach(([leaveId, leave]) => {
      const fromDate = leave.fromDate; // "dd-mm-yyyy"
      const toDate = leave.toDate;     // "dd-mm-yyyy"
      const type = String(leave.type || "").toLowerCase(); // al/cl/ml
      const justificacion = leave.message || "";
      const mesNum = monthFromDMY(fromDate);

      if (month && mesNum !== Number(month)) return; // filtra por mes si se pidió

      const count = u?.leaves?.[type];
      const salida = `${type.toUpperCase()}${Number.isFinite(count) ? `-${count}` : ""}`;
      const tipoPermiso = TYPE_LABELS[type] || type.toUpperCase();

      rows.push({
        id: `${userId}_${leaveId}`,
        usuario,
        salida,
        responsable,
        mes: mesNum,
        desde: parseDMY(fromDate),
        hasta: parseDMY(toDate),
        tipoPermiso,
        justificacion,
      });
    });
  });

  rows.sort((a, b) => (b.desde?.getTime?.() || 0) - (a.desde?.getTime?.() || 0));
  return rows;
}
