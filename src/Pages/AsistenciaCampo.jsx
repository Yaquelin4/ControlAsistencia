// src/pages/AsistenciaCampo.jsx
import { useEffect, useMemo, useState } from "react";
import AttendanceTable from "../components/Table/AttendanceTable";
import {
  fetchAsistenciaByRange,
  fmtFechaCorta,
  updateLeaveStatus,
  STATUS,
} from "../services/asistenciaCampoService";
import * as XLSX from "xlsx";
import "../styles/asistenciaCampo.css";
import { useAuth } from "../contexts/loginContext";

import DatePicker, { registerLocale } from "react-datepicker";
import es from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("es", es);

const STATUS_LABELS_ES = {
  [STATUS.PENDING]: "Pendiente",
  [STATUS.APPROVED]: "Aprobado",
  [STATUS.DENIED]: "Rechazado",
};

function formatDateForExcel(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDDMMYYYYToDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(str);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseDDMMYYYYToTS(s) {
  const d = parseDDMMYYYYToDate(s);
  return d ? d.getTime() : 0;
}

function buildSheetData(rowsArray, { includeResponsable }) {
  return (rowsArray || []).map((r) => {
    const isWithdrawn = Number(r.withdrawalStatus ?? 0) === 1;

    const base = {
      Usuario: r.usuario || "",
      Responsable: r.responsable || "",
      Solicitado: r.appliedDate ? String(r.appliedDate) : "",
      Desde: formatDateForExcel(r.desde),
      Hasta: formatDateForExcel(r.hasta),
      "Tipo permiso": r.tipoPermiso || "",
      Justificación: r.justificacion || "",
      Estado: isWithdrawn
        ? "Retirado"
        : STATUS_LABELS_ES[r.estado || STATUS.PENDING] || "Pendiente",
    };

    if (includeResponsable) return base;

    const { Responsable, ...rest } = base;
    return rest;
  });
}

function exportRangeToExcel(rowsToExport, filename, options) {
  const ws = XLSX.utils.json_to_sheet(buildSheetData(rowsToExport, options));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia".substring(0, 31));
  XLSX.writeFile(wb, filename);
}

const STATUS_ORDER = [STATUS.PENDING, STATUS.APPROVED, STATUS.DENIED];
const rowKeyOf = (r) => r.id || `${r.userId}__${r.leaveId}`;

export default function AsistenciaCampo() {
  const { role, managerCode } = useAuth();
  const isManager = role === "manager";
  const canEditStatus = role === "admin" || role === "manager";

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const [estadoFilter, setEstadoFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState(null);

  useEffect(() => {
    const onDocClick = () => setOpenMenuKey(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAsistenciaByRange(fromDate, toDate);
        setRows(data || []);
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar los datos.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromDate, toDate]);

  const tipoOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const t = (r?.tipoPermiso ?? "").toString().trim();
      if (t) set.add(t);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const changeEstado = async (row, newLabel) => {
    const isWithdrawn = Number(row.withdrawalStatus ?? 0) === 1;
    if (isWithdrawn) {
      setOpenMenuKey(null);
      return;
    }

    const k = rowKeyOf(row);
    const prev = row.estado;

    setRows((prevRows) =>
      prevRows.map((x) => (rowKeyOf(x) === k ? { ...x, estado: newLabel } : x))
    );
    setOpenMenuKey(null);

    try {
      await updateLeaveStatus(row.userId, row.leaveId, newLabel);
    } catch (err) {
      console.error("updateLeaveStatus error:", err);
      setRows((prevRows) =>
        prevRows.map((x) => (rowKeyOf(x) === k ? { ...x, estado: prev } : x))
      );
      alert("No se pudo actualizar el estado en Firebase.");
    }
  };

  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let scoped = rows;

    if (role === "manager" && managerCode) {
      scoped = scoped.filter((r) => {
        const rowManager = r.managerCode || r.manager || null;
        return rowManager === managerCode;
      });
    }

    if (estadoFilter !== "all") {
      scoped = scoped.filter((r) => {
        const isWithdrawn = Number(r.withdrawalStatus ?? 0) === 1;
        if (isWithdrawn) return false;
        return (r.estado || STATUS.PENDING) === estadoFilter;
      });
    }

    if (tipoFilter !== "all") {
      scoped = scoped.filter((r) => {
        const t = (r?.tipoPermiso ?? "").toString().trim();
        return t === tipoFilter;
      });
    }

    const sorted = [...scoped].sort((a, b) => {
      const ta = parseDDMMYYYYToTS(a.appliedDate);
      const tb = parseDDMMYYYYToTS(b.appliedDate);

      if (ta === 0 && tb === 0) return 0;
      if (ta === 0) return 1;
      if (tb === 0) return -1;
      if (tb !== ta) return tb - ta;

      const ida = String(rowKeyOf(a));
      const idb = String(rowKeyOf(b));
      return idb.localeCompare(ida);
    });

    return sorted;
  }, [rows, role, managerCode, estadoFilter, tipoFilter]);

  const columns = useMemo(() => {
    const base = [
      { key: "usuario", header: "Usuario" },
      { key: "responsable", header: "Responsable" },
      {
        key: "appliedDate",
        header: "Solicitado",
        render: (r) => (r.appliedDate ? String(r.appliedDate) : ""),
      },
      { key: "desde", header: "Desde", render: (r) => fmtFechaCorta(r.desde) },
      { key: "hasta", header: "Hasta", render: (r) => fmtFechaCorta(r.hasta) },
      { key: "tipoPermiso", header: "Tipo" },
      { key: "justificacion", header: "Justificación", ellipsis: true },
      {
        key: "estado",
        header: "Estado",
        render: (r) => {
          const isWithdrawn = Number(r.withdrawalStatus ?? 0) === 1;

          const current = r.estado || STATUS.PENDING;
          const k = rowKeyOf(r);
          const stop = (ev) => ev.stopPropagation();

          const classFor = (label) =>
            "estado-pill " +
            (label === STATUS.PENDING
              ? "pending"
              : label === STATUS.APPROVED
              ? "ok"
              : "bad");

          const currentLabelEs = STATUS_LABELS_ES[current] || current;

          if (isWithdrawn) {
            return (
              <div className="estado-dropdown" onClick={stop}>
                <div className="estado-pill withdrawn">Retirado</div>
              </div>
            );
          }

          if (!canEditStatus) {
            return <span className={classFor(current)}>{currentLabelEs}</span>;
          }

          return (
            <div className="estado-dropdown" onClick={stop}>
              <button
                type="button"
                className={classFor(current)}
                onClick={() => setOpenMenuKey(openMenuKey === k ? null : k)}
              >
                {currentLabelEs}
                <span className="chev">▾</span>
              </button>

              {openMenuKey === k && (
                <div className="estado-menu" onClick={stop}>
                  {STATUS_ORDER.map((label) => {
                    const labelEs = STATUS_LABELS_ES[label] || label;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={
                          "estado-option " +
                          (label === STATUS.PENDING
                            ? "pending"
                            : label === STATUS.APPROVED
                            ? "ok"
                            : "bad") +
                          (label === current ? " active" : "")
                        }
                        onClick={() => changeEstado(r, label)}
                      >
                        {labelEs}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        },
      },
    ];

    if (isManager) return base.filter((c) => c.key !== "responsable");
    return base;
  }, [isManager, openMenuKey, canEditStatus]);

  const ToolbarFilters = (
    <div className="period-tabs" onClick={(e) => e.stopPropagation()}>
      <div className="select select--date">
        <span className="select__icon"></span>
        <DatePicker
          locale="es"
          selected={fromDate}
          onChange={(d) => d && setFromDate(d)}
          dateFormat="dd-MM-yyyy"
        />
        <span className="select__label">Desde</span>
      </div>

      <div className="select select--date">
        <span className="select__icon"></span>
        <DatePicker
          locale="es"
          selected={toDate}
          onChange={(d) => d && setToDate(d)}
          dateFormat="dd-MM-yyyy"
          minDate={fromDate}
        />
        <span className="select__label">Hasta</span>
      </div>

      <div className="select">
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value={STATUS.PENDING}>Pendiente</option>
          <option value={STATUS.APPROVED}>Aprobado</option>
          <option value={STATUS.DENIED}>Rechazado</option>
        </select>
        <span className="select__label">Estado</span>
      </div>

      <div className="select">
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
          <option value="all">Todos</option>
          {tipoOptions
            .filter((x) => x !== "all")
            .map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>
        <span className="select__label">Tipo de Permiso</span>
      </div>
    </div>
  );

  const exportName = useMemo(() => {
    const dd = (d) => String(d.getDate()).padStart(2, "0");
    const mm = (d) => String(d.getMonth() + 1).padStart(2, "0");
    const yy = (d) => d.getFullYear();
    const a = fromDate ? `${dd(fromDate)}-${mm(fromDate)}-${yy(fromDate)}` : "inicio";
    const b = toDate ? `${dd(toDate)}-${mm(toDate)}-${yy(toDate)}` : "fin";
    return `asistencia_campo_${a}_a_${b}.xlsx`;
  }, [fromDate, toDate]);

  return (
    <div className="page">
      <h1 className="page-title">Control de Asistencia – Campo</h1>

      {error && <div style={{ padding: 12, color: "#7a0a0a" }}>{error}</div>}

      <AttendanceTable
        columns={columns}
        rows={filteredRows}
        loading={loading}
        emptyText="Sin registros"
        toolbarLeft={ToolbarFilters}
        onExport={() =>
          exportRangeToExcel(filteredRows, exportName, {
            includeResponsable: !isManager,
          })
        }
        getRowKey={(r, i) => r.id ?? `${r.usuario}-${i}`}
      />
    </div>
  );
}
