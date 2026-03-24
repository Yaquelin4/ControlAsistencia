// src/pages/AsistenciaLocal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AttendanceTable from "../components/Table/AttendanceTable";
import { fetchLocalAttendance } from "../services/asistenciaLocalService";
import "../styles/asistenciaLocal.css";
import { TbFileTypeXls } from "react-icons/tb";
import { FaCalendarDay } from "react-icons/fa";
import { FaRegCalendarDays } from "react-icons/fa6";
import { FaUserEdit } from "react-icons/fa";

import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/* ---------- Constantes / util ---------- */
const MESES = [
  { v: 0, t: "Todos" },
  { v: 1, t: "Enero" },
  { v: 2, t: "Febrero" },
  { v: 3, t: "Marzo" },
  { v: 4, t: "Abril" },
  { v: 5, t: "Mayo" },
  { v: 6, t: "Junio" },
  { v: 7, t: "Julio" },
  { v: 8, t: "Agosto" },
  { v: 9, t: "Septiembre" },
  { v: 10, t: "Octubre" },
  { v: 11, t: "Noviembre" },
  { v: 12, t: "Diciembre" },
];

function toKey(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function normalizeDateKey(value) {
  if (!value) return "";

  if (value instanceof Date) return toKey(value);

  const s = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s.replaceAll("/", "-");

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return toKey(d);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toKey(d);

  return s;
}

/** Convierte "HH:MM:SS" a segundos para ordenar. Si no existe, devuelve Infinity. */
function timeToSec(t) {
  if (!t) return Number.POSITIVE_INFINITY;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] ?? 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
    return Number.POSITIVE_INFINITY;
  }
  return hh * 3600 + mm * 60 + ss;
}

/**
 * Convierte minutos totales a string "HH:MM"
 */
function formatHoursFromMinutes(totalMinutes) {
  const mins = Number.isFinite(totalMinutes) ? totalMinutes : 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Agrupa asistencia por día:
 * - Junta todos los pares del día (entrada/salida) en una lista
 * - Ordena por hora de entrada (más temprano primero)
 * - Asigna:
 *    par[0] => mañana, par[1] => tarde
 */
function groupAttendanceByDay(rows) {
  const map = new Map();

  (rows || []).forEach((row) => {
    const userId = row.userId || row.usuario || "Desconocido";
    const fechaKey = normalizeDateKey(row.fecha || row.date || row.timestamp);
    const key = `${userId}__${fechaKey}`;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        usuario: row.usuario || userId,
        userId,
        fecha: fechaKey,

        // Bloque mañana
        entrada: null,
        salida: null,
        oficinaEntrada: null,
        oficinaSalida: null,
        observaciones: null,

        // Bloque tarde
        entrada2: null,
        salida2: null,
        oficinaEntrada2: null,
        oficinaSalida2: null,
        observaciones2: null,

        // agregados
        totalMinutes: 0,

        // lista de pares (para ordenar)
        pairs: [],
      });
    }

    const g = map.get(key);

    const mins = Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
    g.totalMinutes += mins;

    g.pairs.push({
      entrada: row.entrada ?? null,
      salida: row.salida ?? null,
      oficinaEntrada: row.oficinaEntrada || null,
      oficinaSalida: row.oficinaSalida || null,
      observaciones: row.observaciones || null,
      _entradaSec: timeToSec(row.entrada),
    });
  });

  const out = Array.from(map.values()).map((g) => {
    const sorted = [...(g.pairs || [])].sort((a, b) => a._entradaSec - b._entradaSec);

    const p1 = sorted[0] || null;
    const p2 = sorted[1] || null;

    return {
      id: g.id,
      usuario: g.usuario,
      userId: g.userId,
      fecha: g.fecha,

      entrada: p1?.entrada ?? null,
      salida: p1?.salida ?? null,
      oficinaEntrada: p1?.oficinaEntrada ?? null,
      oficinaSalida: p1?.oficinaSalida ?? null,
      observaciones: p1?.observaciones ?? null,

      entrada2: p2?.entrada ?? null,
      salida2: p2?.salida ?? null,
      oficinaEntrada2: p2?.oficinaEntrada ?? null,
      oficinaSalida2: p2?.oficinaSalida ?? null,
      observaciones2: p2?.observaciones ?? null,

      totalMinutes: g.totalMinutes,
    };
  });

  return out;
}

/**
 * Datos para exportar a Excel
 */
function buildSheetData(rowsArray) {
  return (rowsArray || []).map((r) => ({
    Usuario: r.usuario || "",
    Fecha: r.fecha || "",
    "Entrada mañana": r.entrada ?? "No registrado",
    "Salida mañana": r.salida ?? "No registrado",
    "Entrada tarde": r.entrada2 ?? "No registrado",
    "Salida tarde": r.salida2 ?? "No registrado",
    "Total horas": formatHoursFromMinutes(r.totalMinutes),
  }));
}

function writeXlsxFile(wb, filename) {
  try {
    XLSX.writeFile(wb, filename);
  } catch (e) {
    console.error("Error al crear XLSX", e);
  }
}

function exportRowsToXlsx({ rows, sheetName = "Datos", filename = "export.xlsx" }) {
  const data = buildSheetData(rows);
  const ws = XLSX.utils.json_to_sheet(data);

  ws["!cols"] = [
    { wch: 28 }, // Usuario
    { wch: 14 }, // Fecha
    { wch: 16 }, // Entrada M
    { wch: 16 }, // Salida M
    { wch: 16 }, // Entrada T
    { wch: 16 }, // Salida T
    { wch: 14 }, // Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  writeXlsxFile(wb, filename);
}

/* ---------- Componente principal ---------- */
export default function AsistenciaLocal() {
  const [mode, setMode] = useState("day");

  const [day, setDay] = useState(new Date());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [monthRows, setMonthRows] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [displayLoadingMonth, setDisplayLoadingMonth] = useState(false);
  const loadingMonthTimer = useRef(null);
  const [errorMonth, setErrorMonth] = useState("");

  const [usersData, setUsersData] = useState([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [displayLoadingUser, setDisplayLoadingUser] = useState(false);
  const loadingUserTimer = useRef(null);
  const [errorUser, setErrorUser] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState(null);

  const mesLabel = useMemo(
    () => MESES.find((x) => x.v === Number(month))?.t ?? "Mes",
    [month]
  );

  const loadMonthRows = async (mParam) => {
    setLoadingMonth(true);
    setErrorMonth("");
    try {
      const monthParam = mParam === 0 ? null : mParam;
      const data = await fetchLocalAttendance({ month: monthParam });
      setMonthRows(groupAttendanceByDay(data || []));
    } catch (e) {
      console.error(e);
      setErrorMonth("No se pudo cargar asistencia (mes).");
      setMonthRows([]);
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadUsersDataAll = async () => {
    setLoadingUser(true);
    setErrorUser("");
    try {
      const data = await fetchLocalAttendance({ month: null });
      setUsersData(groupAttendanceByDay(data || []));
    } catch (e) {
      console.error(e);
      setErrorUser("No se pudo cargar asistencia (usuarios).");
      setUsersData([]);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    if (loadingMonth) {
      if (loadingMonthTimer.current) clearTimeout(loadingMonthTimer.current);
      setDisplayLoadingMonth(true);
      return;
    }
    if (loadingMonthTimer.current) clearTimeout(loadingMonthTimer.current);
    loadingMonthTimer.current = setTimeout(() => {
      setDisplayLoadingMonth(false);
      loadingMonthTimer.current = null;
    }, 200);
    return () => {
      if (loadingMonthTimer.current) {
        clearTimeout(loadingMonthTimer.current);
        loadingMonthTimer.current = null;
      }
    };
  }, [loadingMonth]);

  useEffect(() => {
    if (loadingUser) {
      if (loadingUserTimer.current) clearTimeout(loadingUserTimer.current);
      setDisplayLoadingUser(true);
      return;
    }
    if (loadingUserTimer.current) clearTimeout(loadingUserTimer.current);
    loadingUserTimer.current = setTimeout(() => {
      setDisplayLoadingUser(false);
      loadingUserTimer.current = null;
    }, 200);
    return () => {
      if (loadingUserTimer.current) {
        clearTimeout(loadingUserTimer.current);
        loadingUserTimer.current = null;
      }
    };
  }, [loadingUser]);

  useEffect(() => {
    if (mode === "day") {
      const m = new Date(day).getMonth() + 1;
      setMonth(m);
      loadMonthRows(m);
    } else if (mode === "month") {
      loadMonthRows(month);
    } else if (mode === "user") {
      loadUsersDataAll();
      setExpandedUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === "month") loadMonthRows(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    if (mode !== "day") return;
    const m = new Date(day).getMonth() + 1;
    if (m !== month) setMonth(m);
    loadMonthRows(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const rowsForDay = useMemo(() => {
    const key = toKey(day);
    return (monthRows || []).filter((r) => (r.fecha || "") === key);
  }, [monthRows, day]);

  const rowsForMonth = monthRows || [];

  const usersList = useMemo(() => {
    const map = new Map();
    (usersData || []).forEach((r) => {
      const id = r.userId || r.usuario || r.id || "Desconocido";
      const name = r.usuario || id;
      if (!map.has(id)) map.set(id, { userId: id, usuario: name, count: 0 });
      map.get(id).count += 1;
    });

    let arr = Array.from(map.values());
    const q = String(userSearch || "").trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (u) =>
          (u.usuario || "").toLowerCase().includes(q) ||
          (u.userId || "").toLowerCase().includes(q)
      );
    }
    arr.sort((a, b) => (a.usuario || "").localeCompare(b.usuario || ""));
    return arr;
  }, [usersData, userSearch]);

  const handleExportDayMonth = () => {
    if (mode === "day") {
      const sheetName = toKey(day);
      exportRowsToXlsx({
        rows: rowsForDay,
        sheetName,
        filename: `asistencia_local_${sheetName}.xlsx`,
      });
    } else {
      const sheetName = month === 0 ? "Todos" : mesLabel;
      exportRowsToXlsx({
        rows: rowsForMonth,
        sheetName,
        filename: `asistencia_local_${sheetName}.xlsx`,
      });
    }
  };

  const handleExportUsers = () => {
    if (!usersData.length) return;

    if (!expandedUserId) {
      const wb = XLSX.utils.book_new();

      (usersList || []).forEach((u) => {
        const userRows = usersData.filter((r) => r.userId === u.userId);
        const data = buildSheetData(userRows);
        const ws = XLSX.utils.json_to_sheet(data);

        ws["!cols"] = [
          { wch: 28 },
          { wch: 14 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
          { wch: 14 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, (u.usuario || u.userId).substring(0, 31));
      });

      writeXlsxFile(wb, `asistencia_usuarios_Todos.xlsx`);
    } else {
      const userRows = usersData.filter((r) => r.userId === expandedUserId);
      const u = usersList.find((x) => x.userId === expandedUserId) || { usuario: expandedUserId };

      exportRowsToXlsx({
        rows: userRows,
        sheetName: u.usuario,
        filename: `asistencia_${u.usuario}_Todos.xlsx`,
      });
    }
  };

  const columnsLocal = [
    { key: "usuario", header: "Usuario" },
    { key: "fecha", header: "Fecha" },
    { key: "entrada", header: "Entrada (mañana)", render: (r) => r.entrada ?? "No registrado" },
    { key: "salida", header: "Salida (mañana)", render: (r) => r.salida ?? "No registrado" },
    { key: "entrada2", header: "Entrada (tarde)", render: (r) => r.entrada2 ?? "No registrado" },
    { key: "salida2", header: "Salida (tarde)", render: (r) => r.salida2 ?? "No registrado" },
    { key: "totalMinutes", header: "Total horas", render: (r) => formatHoursFromMinutes(r.totalMinutes) },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Control de Asistencia – Oficina</h1>

      <div className="toolbar">
        <div className="btn-group">
          <button
            className={`btn ${mode === "day" ? "primary" : ""}`}
            onClick={() => {
              setMode("day");
              setExpandedUserId(null);
            }}
          >
            <FaCalendarDay className="btn-icon" />
            Por día
          </button>

          <button
            className={`btn ${mode === "month" ? "primary" : ""}`}
            onClick={() => {
              setMode("month");
              setExpandedUserId(null);
            }}
          >
            <FaRegCalendarDays className="btn-icon" />
            Por mes
          </button>

          <button
            className={`btn ${mode === "user" ? "primary" : ""}`}
            onClick={() => {
              setMode("user");
              setExpandedUserId(null);
            }}
          >
            <FaUserEdit className="btn-icon" />
            Por usuario
          </button>
        </div>

        {mode === "day" && (
          <div className="select select--date">
            <span className="select__icon">📅</span>
            <DatePicker locale="es" selected={day} onChange={(d) => d && setDay(d)} dateFormat="dd-MM-yyyy" />
            <span className="select__label">{toKey(day)}</span>
          </div>
        )}

        {mode === "month" && (
          <div className="select">
            <span className="select__icon">📅</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MESES.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.t}
                </option>
              ))}
            </select>
            <span className="select__label">{mesLabel}</span>
          </div>
        )}

        {mode === "user" && (
          <div className="user-search">
            <span className="select__icon">👥</span>
            <div className="select__label" />
            <input
              className="input-search"
              placeholder="Buscar usuario..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
        )}

        <div className="export-container">
          {mode === "user" ? (
            <button
              className="btn primary"
              onClick={handleExportUsers}
              disabled={displayLoadingUser || (!usersData || usersData.length === 0)}
            >
              <TbFileTypeXls className="btn-icon" />
              Generar Reporte Usuario
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={handleExportDayMonth}
              disabled={displayLoadingMonth || ((!monthRows || monthRows.length === 0) && mode === "month")}
            >
              <TbFileTypeXls className="btn-icon" />
              Generar Reporte
            </button>
          )}
        </div>
      </div>

      {mode !== "user" && errorMonth && <div className="error-message">{errorMonth}</div>}
      {mode === "user" && errorUser && <div className="error-message">{errorUser}</div>}

      {(mode === "day" || mode === "month") && (
        <>
          {displayLoadingMonth ? (
            <div className="loading">Cargando…</div>
          ) : (
            <AttendanceTable
              columns={columnsLocal}
              rows={mode === "day" ? rowsForDay : rowsForMonth}
              loading={false}
              emptyText={mode === "day" ? "Sin registros para el día" : "Sin registros"}
              getRowKey={(r, i) => r.id ?? `${r.usuario}-${r.fecha}-${i}`}
            />
          )}
        </>
      )}

      {mode === "user" && (
        <>
          {displayLoadingUser ? (
            <div className="loading">Cargando…</div>
          ) : (
            <div className="users-wrapper">
              <h2 className="users-title">Usuarios — {usersList.length}</h2>

              <div className="users-list">
                {usersList.length === 0 && <div className="empty">Usuario no registrado</div>}

                {usersList.map((u) => {
                  const isOpen = expandedUserId === u.userId;
                  const userRows = usersData.filter((r) => r.userId === u.userId);

                  return (
                    <div key={u.userId} className="user-card">
                      <div
                        className="user-card__header"
                        onClick={() => setExpandedUserId(isOpen ? null : u.userId)}
                      >
                        <div className="user-info">
                          <div className="user-name">{u.usuario}</div>
                          <div className="user-meta">Días con registros: {u.count}</div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="user-card__body">
                          <AttendanceTable
                            columns={[
                              { key: "fecha", header: "Fecha" },
                              { key: "entrada", header: "Entrada (mañana)", render: (r) => r.entrada ?? "No registrado" },
                              { key: "salida", header: "Salida (mañana)", render: (r) => r.salida ?? "No registrado" },
                              { key: "entrada2", header: "Entrada (tarde)", render: (r) => r.entrada2 ?? "No registrado" },
                              { key: "salida2", header: "Salida (tarde)", render: (r) => r.salida2 ?? "No registrado" },
                              { key: "totalMinutes", header: "Total horas", render: (r) => formatHoursFromMinutes(r.totalMinutes) },
                              {
                                key: "observaciones",
                                header: "Observaciones",
                                render: (r) => {
                                  const parts = [];
                                  if (r.observaciones) parts.push(`M: ${r.observaciones}`);
                                  if (r.observaciones2) parts.push(`T: ${r.observaciones2}`);
                                  return parts.join(" | ");
                                },
                              },
                            ]}
                            rows={userRows}
                            loading={false}
                            emptyText="Sin registros para este usuario"
                            getRowKey={(r, i) => r.id ?? `${r.userId}-${r.fecha}-${i}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
