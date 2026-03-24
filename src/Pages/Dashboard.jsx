import { useEffect, useMemo, useState } from "react";
import { fetchDashboardData } from "../services/dashboardService";
import "../styles/dashboard.css";
import { useAuth } from "../contexts/loginContext";

import { Bar, Pie } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

/* ================= MESES ================= */
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

export default function Dashboard() {
  const { role, managerCode } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* SOLO PARA GRÁFICO DE BARRAS */
  const [monthPermisos, setMonthPermisos] = useState(0);
  const [yearPermisos, setYearPermisos] = useState(
    new Date().getFullYear()
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchDashboardData({
          role,
          managerCode,
          monthPermisos: monthPermisos === 0 ? null : monthPermisos,
          yearPermisos,
        });
        setData(res);
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role, managerCode, monthPermisos, yearPermisos]);

  /* ================= GRÁFICOS ================= */

  const barData = useMemo(() => {
    if (!data) return null;
    return {
      labels: ["Pendiente", "Aprobado", "Rechazado"],
      datasets: [
        {
          data: [data.pendientes, data.aprobados, data.rechazados],
          backgroundColor: ["#facc15", "#22c55e", "#ef4444"],
          borderRadius: 8,
        },
      ],
    };
  }, [data]);

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    }),
    []
  );

  const pieData = useMemo(() => {
    if (!data?.permisosPorTipo?.length) return null;
    return {
      labels: data.permisosPorTipo.map((x) => x.tipo),
      datasets: [
        {
          data: data.permisosPorTipo.map((x) => x.total),
          backgroundColor: [
            "#60a5fa",
            "#34d399",
            "#fbbf24",
            "#f87171",
            "#a78bfa",
          ],
        },
      ],
    };
  }, [data]);

  if (loading) return <p>Cargando dashboard...</p>;
  if (error) return <p className="dash-error">{error}</p>;
  if (!data) return null;

  const {
    totalUsers,
    activeUsers,
    asistenciaCompleta,
    asistenciaIncompleta,
    sinMarcacion,
    cumplimientoPct,
  } = data;

  const mesLabel =
    MESES.find((m) => m.v === monthPermisos)?.t || "Todos";

  return (
    <div className="page dashboard-page">
      <h1 className="dash-title">
        Dashboard {role === "manager" ? "– Mi equipo" : "General"}
      </h1>

      {/* TARJETAS (NO TOCADAS) */}
      <div className="dash-grid">
        <div className="dash-card primary">
          <h3>Colaboradores</h3>
          <p className="dash-number">{totalUsers}</p>
          <span className="dash-chip">Activos: {activeUsers}</span>
        </div>

        <div className="dash-card">
          <h3>Estado de asistencia (HOY)</h3>
          <div className="dash-mini">
            <span>Completos: {asistenciaCompleta}</span>
            <span>Incompletos: {asistenciaIncompleta}</span>
            <span>Sin marcación: {sinMarcacion}</span>
          </div>
        </div>

        <div className="dash-card">
          <h3>Cumplimiento de hoy</h3>
          <p className="dash-number">{cumplimientoPct}%</p>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${cumplimientoPct}%` }}
            />
          </div>

          <div className="dash-mini">
            {asistenciaCompleta} de {activeUsers} colaboradores
          </div>

          <span className="dash-chip">Meta: 100%</span>
        </div>
      </div>

      {/* ================= GRÁFICOS ================= */}
      <div className="dash-charts-row">
        <div className="dash-section">
          <div className="dash-section-header">
            <h2>
              Permisos por estado ({mesLabel} {yearPermisos})
            </h2>

            <div className="filters-inline">
              <select
                value={monthPermisos}
                onChange={(e) =>
                  setMonthPermisos(Number(e.target.value))
                }
              >
                {MESES.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.t}
                  </option>
                ))}
              </select>

              <select
                value={yearPermisos}
                onChange={(e) =>
                  setYearPermisos(Number(e.target.value))
                }
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="dash-chart-container">
            {barData && <Bar data={barData} options={barOptions} />}
          </div>
        </div>

        <div className="dash-section">
          <h2>Tipos de permiso</h2>
          <div className="dash-chart-container--small">
            {pieData && <Pie data={pieData} />}
          </div>
        </div>
      </div>
    </div>
  );
}
