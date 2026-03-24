// src/components/Table/AttendanceTable.jsx
import React from "react";
import "../Table/table.css";
import { TbFileTypeXls } from "react-icons/tb";

// =================== Componente de tabla reutilizable ===================
export default function AttendanceTable({
  columns = [],
  rows = [],
  loading = false,
  emptyText = "Sin registros",
  actions,
  onExport,
  toolbarLeft,
  toolbarRight,
  getRowKey,
  dense = false,

  // NUEVO (opcional): footer institucional
  footerText = "guamanpoma.org",
}) {
  // --- Generador de clave única por fila ---
  const keyGetter = getRowKey || ((row, i) => row.id ?? i);

  const colSpan = columns.length + (actions ? 1 : 0);

  // --- Render principal ---
  return (
    <div className="att-card card">
      {/* Barra superior (filtros, botones, exportar) */}
      {(toolbarLeft || toolbarRight || onExport) && (
        <div className="att-toolbar toolbar" style={{ gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {toolbarLeft}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {toolbarRight}
            {onExport && (
              <button className="btn primary" onClick={onExport}>
                <TbFileTypeXls className="btn-icon" />
                Generar reporte
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenedor de la tabla */}
      <div style={{ overflowX: "auto" }}>
        <table className={`att-table table ${dense ? "table--dense" : ""}`}>
          {/* Encabezado de columnas */}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    width: c.width,
                    textAlign: c.align || "left",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.header}
                </th>
              ))}
              {actions && <th style={{ width: 40 }} />}
            </tr>
          </thead>

          {/* Cuerpo de la tabla */}
          <tbody>
            {/* Estado de carga */}
            {loading && (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: "center" }}>
                  Cargando...
                </td>
              </tr>
            )}

            {/* Sin registros */}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="empty">
                  {emptyText}
                </td>
              </tr>
            )}

            {/* Filas con datos */}
            {!loading &&
              rows.map((row, idx) => (
                <tr key={keyGetter(row, idx)}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align || "left" }}
                      className={c.ellipsis ? "ellipsis" : undefined}
                      title={c.ellipsis ? (row[c.key] ?? "") : undefined}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                  {actions && <td className="actions">{actions(row)}</td>}
                </tr>
              ))}
          </tbody>

          {/* Footer institucional (última fila) */}
          <tfoot>
            <tr className="att-tfoot">
              <td colSpan={colSpan}>{footerText}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
