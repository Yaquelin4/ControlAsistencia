// src/pages/Asistencia.jsx
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { fetchAsistenciaByMonth, fmtFechaCorta } from "../services/asistenciaService";
import "../styles/asistencia.css";

const MESES = [
  { v: 0,  t: "Todos" },
  { v: 1,  t: "Enero" }, { v: 2,  t: "Febrero" }, { v: 3,  t: "Marzo" },
  { v: 4,  t: "Abril" }, { v: 5,  t: "Mayo" }, { v: 6,  t: "Junio" },
  { v: 7,  t: "Julio" }, { v: 8,  t: "Agosto" }, { v: 9,  t: "Septiembre" },
  { v: 10, t: "Octubre" }, { v: 11, t: "Noviembre" }, { v: 12, t: "Diciembre" },
];

// ----------------- Helpers para Excel -----------------
function formatDateForExcel(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function buildSheetData(rowsArray) {
  return rowsArray.map((r) => ({
    Usuario: r.usuario || "",
    Salida: r.salida || "",
    Responsable: r.responsable || "",
    Mes: r.mes ? (MESES.find((m) => m.v === Number(r.mes))?.t ?? r.mes) : "",
    Desde: formatDateForExcel(r.desde),
    Hasta: formatDateForExcel(r.hasta),
    "Tipo permiso": r.tipoPermiso || "",
    Justificación: r.justificacion || "",
  }));
}

/** Exporta solo el mes seleccionado (rowsToExport debe contener solo ese mes) */
function exportMonthToExcel(selectedMonth, rowsToExport) {
  const sheetName = selectedMonth ? `${MESES.find(m => m.v === Number(selectedMonth))?.t ?? `Mes-${selectedMonth}`}` : "Mes";
  const worksheetData = buildSheetData(rowsToExport);
  const ws = XLSX.utils.json_to_sheet(worksheetData, {
    header: [
      "Usuario",
      "Salida",
      "Responsable",
      "Mes",
      "Desde",
      "Hasta",
      "Tipo permiso",
      "Justificación",
    ],
  });
  ws["!cols"] = [
    { wch: 25 }, { wch: 12 }, { wch: 22 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 40 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName).substring(0, 31));
  const filename = `asistencia_${sheetName}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/** Exporta todas las filas en hojas separadas por mes */
function exportAllMonthsToExcel(allRows) {
  if (!allRows || allRows.length === 0) return;
  const groups = {};
  allRows.forEach((r) => {
    const m = r.mes ? String(r.mes) : "SinMes";
    if (!groups[m]) groups[m] = [];
    groups[m].push(r);
  });

  const wb = XLSX.utils.book_new();

  Object.keys(groups).sort((a, b) => {
    if (a === "SinMes") return 1;
    if (b === "SinMes") return -1;
    return Number(a) - Number(b);
  }).forEach((mKey) => {
    const rowsArr = groups[mKey];
    const sheetName = mKey === "SinMes"
      ? "SinMes"
      : (MESES[Number(mKey)]?.t || `Mes-${mKey}`);
    const worksheetData = buildSheetData(rowsArr);
    const ws = XLSX.utils.json_to_sheet(worksheetData, {
      header: [
        "Usuario",
        "Salida",
        "Responsable",
        "Mes",
        "Desde",
        "Hasta",
        "Tipo permiso",
        "Justificación",
      ],
    });
    ws["!cols"] = [
      { wch: 25 }, { wch: 12 }, { wch: 22 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, String(sheetName).substring(0, 31));
  });

  XLSX.writeFile(wb, `asistencia_todos_meses.xlsx`);
}

// ----------------- Componente -----------------
export default function Asistencia() {
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth); // 0 = Todos, 1..12
  const [loading, setLoading] = useState(false);
  const [rowsAll, setRowsAll] = useState([]); // todos los registros
  const [rows, setRows] = useState([]);       // registros filtrados para la vista
  const [error, setError] = useState("");

  const mesLabel = useMemo(
    () => MESES.find((x) => x.v === Number(month))?.t ?? "Mes",
    [month]
  );

  // Carga todos los datos UNA vez al montar
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAsistenciaByMonth(null); // trae todo
        if (!mounted) return;
        setRowsAll(data);
        // filtra para la vista inicial (mes actual)
        if (Number(month) === 0) setRows(data);
        else setRows(data.filter((r) => Number(r.mes) === Number(month)));
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError("No se pudieron cargar los datos.");
        setRowsAll([]);
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadAll();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambie el month, filtramos localmente (sin llamar al servidor)
  useEffect(() => {
    if (!rowsAll) return;
    if (Number(month) === 0) setRows(rowsAll);
    else setRows(rowsAll.filter((r) => Number(r.mes) === Number(month)));
  }, [month, rowsAll]);

  // botón: genera según la selección actual
  const handleGenerar = () => {
    if (Number(month) === 0) {
      // Todos los meses
      exportAllMonthsToExcel(rowsAll);
    } else {
      // Solo el mes seleccionado (rows ya está filtrado)
      exportMonthToExcel(month, rows);
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__role">ADMINISTRADOR</div>
        <nav className="sidebar__nav">
          <button className="navbtn active">Inicio</button>
          <button className="navbtn">Asistencia Local</button>
          <button className="navbtn">Agregar Usuario</button>
          <button className="navbtn danger">Salir</button>
        </nav>
      </aside>

      {/* Main */}
      <main className="content">
        <header className="header">
          <h1>ASISTENCIA DE CAMPO</h1>
          <div className="userbox">
            <div className="userbox__name">Oscar</div>
            <div className="userbox__role">Administrador</div>
            <div className="userbox__avatar" />
          </div>
        </header>

        {/* Toolbar: selector de mes + botón generar (según selección) */}
        <div className="toolbar">
          <div className="select">
            <span className="select__icon" role="img" aria-label="calendar">📅</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MESES.map((m) => (
                <option key={m.v} value={m.v}>{m.t}</option>
              ))}
            </select>
            <span className="select__label">{mesLabel}</span>
          </div>

          <button
            className="btn"
            onClick={handleGenerar}
            disabled={loading || rowsAll.length === 0}
            style={{ marginLeft: 8, background: "#a00f0f", color: "#fff" }}
          >
            {loading ? "Cargando..." : (Number(month) === 0 ? "Generar reporte (todos los meses)" : `Generar reporte (${MESES.find(m=>m.v===Number(month))?.t})`)}
          </button>
        </div>

        {/* Card + Table */}
        <div className="card">
          {error && <div style={{ padding: 12, color: "#a00f0f" }}>{error}</div>}
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Salida</th>
                <th>Responsable</th>
                <th>Mes</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Tipo permiso</th>
                <th>Justificación</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty">Sin registros</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="usercell">
                    <span
                      className="avatar"
                      style={{
                        backgroundImage: r.avatarUrl ? `url(${r.avatarUrl})` : undefined,
                      }}
                    />
                    {r.usuario}
                  </td>
                  <td>{r.salida}</td>
                  <td>{r.responsable}</td>
                  <td>{r.mes ? (MESES.find((m) => m.v === Number(r.mes))?.t ?? r.mes) : ""}</td>
                  <td>{fmtFechaCorta(r.desde)}</td>
                  <td>{fmtFechaCorta(r.hasta)}</td>
                  <td>{r.tipoPermiso}</td>
                  <td className="ellipsis" title={r.justificacion}>{r.justificacion}</td>
                  <td className="actions">⋯</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
