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

  const isPrimitive = (value) =>
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";

  const wrapNoTranslate = (value) => {
    if (React.isValidElement(value)) return value;

    if (isPrimitive(value)) {
      return (
        <span className="notranslate" translate="no">
          {String(value)}
        </span>
      );
    }

    if (value == null) {
      return (
        <span className="notranslate" translate="no">
          -
        </span>
      );
    }

    return value;
  };

  return (
    <div className="att-card notranslate" translate="no">
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
                  {columns.map((c) => {
                    const rawValue = renderCellValue(row, c);
                    const cellTitle =
                      c.ellipsis && !React.isValidElement(rawValue) && rawValue != null
                        ? String(rawValue)
                        : undefined;

                    return (
                      <td
                        key={c.key}
                        style={{ textAlign: c.align || "left" }}
                        className={c.ellipsis ? "ellipsis notranslate" : "notranslate"}
                        title={cellTitle}
                        translate="no"
                      >
                        {wrapNoTranslate(rawValue)}
                      </td>
                    );
                  })}

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
              <div
                className="att-mobile-card notranslate"
                translate="no"
                key={keyGetter(row, idx)}
              >
                <div className="att-mobile-card__body">
                  {columns.map((c) => {
                    const rawValue = renderCellValue(row, c);

                    return (
                      <div className="att-mobile-item" key={c.key}>
                        <div className="att-mobile-item__label">{c.header}</div>
                        <div
                          className="att-mobile-item__value notranslate"
                          translate="no"
                        >
                          {wrapNoTranslate(rawValue)}
                        </div>
                      </div>
                    );
                  })}
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