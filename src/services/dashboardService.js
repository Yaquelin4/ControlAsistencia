import { ref, get, child } from "firebase/database";
import { dbAsistencia } from "../firebase";
import { fetchAsistenciaByMonth, STATUS } from "./asistenciaCampoService";

function getMonth(date) {
  return date instanceof Date ? date.getMonth() + 1 : null;
}

function getYear(date) {
  return date instanceof Date ? date.getFullYear() : null;
}

export async function fetchDashboardData({
  role,
  managerCode,
  monthPermisos = null,
  yearPermisos = null,
} = {}) {
  const root = ref(dbAsistencia);

  /* ================= USUARIOS ================= */
  const usersSnap = await get(child(root, "users"));
  const users = usersSnap.exists() ? usersSnap.val() : {};

  const activeUsersAll = Object.entries(users)
    .filter(([, u]) => u?.active !== false)
    .map(([uid, u]) => ({
      uid,
      managerCode: u.managerCode || u.manager || null,
    }));

  const scopedUsers =
    role === "manager" && managerCode
      ? activeUsersAll.filter((u) => u.managerCode === managerCode)
      : activeUsersAll;

  const totalUsers = scopedUsers.length;
  const activeUsers = scopedUsers.length;

  /* ================= ASISTENCIA (YA EXISTENTE) ================= */
  let asistenciaCompleta = 0;
  let asistenciaIncompleta = 0;
  let sinMarcacion = activeUsers;
  let cumplimientoPct = 0;

  /* ================= PERMISOS ================= */
  const leavesAll = await fetchAsistenciaByMonth(null);

  const leavesScoped =
    role === "manager" && managerCode
      ? leavesAll.filter(
          (r) =>
            (r.managerCode || r.manager || null) === managerCode
        )
      : leavesAll;

  /* SOLO PARA EL GRÁFICO DE BARRAS */
  const leavesForBar = leavesScoped.filter((r) => {
    const m = getMonth(r.desde);
    const y = getYear(r.desde);

    if (yearPermisos && y !== yearPermisos) return false;
    if (monthPermisos && m !== monthPermisos) return false;

    return true;
  });

  const pendientes = leavesForBar.filter(
    (r) => r.estado === STATUS.PENDING
  ).length;

  const aprobados = leavesForBar.filter(
    (r) => r.estado === STATUS.APPROVED
  ).length;

  const rechazados = leavesForBar.filter(
    (r) => r.estado === STATUS.DENIED
  ).length;

  /* PIE (HISTÓRICO, NO FILTRADO) */
  const tipoCounts = {};
  leavesScoped.forEach((r) => {
    const tipo = String(r.tipoPermiso || "Sin tipo").trim();
    tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1;
  });

  const permisosPorTipo = Object.entries(tipoCounts).map(
    ([tipo, total]) => ({ tipo, total })
  );

  return {
    totalUsers,
    activeUsers,
    asistenciaCompleta,
    asistenciaIncompleta,
    sinMarcacion,
    cumplimientoPct,
    pendientes,
    aprobados,
    rechazados,
    permisosPorTipo,
  };
}
