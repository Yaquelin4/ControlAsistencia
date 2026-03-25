// src/components/Table/AttendanceTable.jsx
import React from "react";
import "../Table/table.css";
import { TbFileTypeXls } from "react-icons/tb";

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
  footerText = "guamanpoma.org",
  mobileCardView = true,
}) {
  const keyGetter = getRowKey || ((row, i) => row.id ?? i);
  const colSpan = columns.length + (actions ? 1 : 0);

  const renderCellValue = (row, column) => {
    if (column.render) return column.render(row);
    return row[column.key];
  };

  return (
    <div className="att-card">
      {(toolbarLeft || toolbarRight || onExport) && (
        <div className="att-toolbar">
          <div className="att-toolbar__left">{toolbarLeft}</div>

          <div className="att-toolbar__right">
            {toolbarRight}

            {onExport && (
              <button type="button" className="btn primary" onClick={onExport}>
                <TbFileTypeXls className="btn-icon" />
                <span>Generar reporte</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Vista desktop / tablet */}
      <div className="att-table-wrap">
        <table className={`att-table ${dense ? "table--dense" : ""}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    width: c.width,
                    textAlign: c.align || "left",
                  }}
                >
                  {c.header}
                </th>
              ))}
              {actions && <th style={{ width: 60, textAlign: "right" }}>Acciones</th>}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan}>
                  <div className="att-loading">
                    <div className="att-loading__spinner" />
                    <span>Cargando registros...</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="empty">
                  {emptyText}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, idx) => (
                <tr key={keyGetter(row, idx)}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align || "left" }}
                      className={c.ellipsis ? "ellipsis" : undefined}
                      title={
                        c.ellipsis && typeof row[c.key] !== "object"
                          ? String(row[c.key] ?? "")
                          : undefined
                      }
                    >
                      {renderCellValue(row, c)}
                    </td>
                  ))}

                  {actions && <td className="actions">{actions(row)}</td>}
                </tr>
              ))}
          </tbody>

          {footerText && (
            <tfoot>
              <tr className="att-tfoot">
                <td colSpan={colSpan}>{footerText}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Vista móvil tipo tarjetas */}
      {mobileCardView && (
        <div className="att-mobile-list">
          {loading && (
            <div className="att-mobile-state">
              <div className="att-loading">
                <div className="att-loading__spinner" />
                <span>Cargando registros...</span>
              </div>
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="att-mobile-state empty">{emptyText}</div>
          )}

          {!loading &&
            rows.map((row, idx) => (
              <div className="att-mobile-card" key={keyGetter(row, idx)}>
                <div className="att-mobile-card__body">
                  {columns.map((c) => (
                    <div className="att-mobile-item" key={c.key}>
                      <div className="att-mobile-item__label">{c.header}</div>
                      <div className="att-mobile-item__value">
                        {renderCellValue(row, c)}
                      </div>
                    </div>
                  ))}
                </div>

                {actions && (
                  <div className="att-mobile-card__actions">{actions(row)}</div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}