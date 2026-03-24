// src/components/Layout/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { MdOutlineDashboard } from "react-icons/md";
import { FaCarTunnel } from "react-icons/fa6";
import { MdLocationPin } from "react-icons/md";
import { IoPersonAddSharp, IoExit } from "react-icons/io5";
import { useAuth } from "../../contexts/loginContext";
import "./sidebar.css";

export default function Sidebar() {
  const { logout, role, managerCode } = useAuth();
  const navigate = useNavigate();

  const isAdmin = role === "admin";
  const isManager = role === "manager";

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Error en logout:", err);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const panelTitle = isAdmin
    ? "PANEL ADMIN"
    : isManager
    ? "PANEL MANAGER"
    : "PANEL PRINCIPAL";

  return (
    <aside className="sidebar">
      <div className="sidebar__role">
        {panelTitle}
        {isManager && managerCode ? (
          <div className="sidebar__subrole">{managerCode}</div>
        ) : null}
      </div>

      <nav className="sidebar__nav">
        {/* 1) Dashboard (admin + manager) */}
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
        >
          <MdOutlineDashboard className="navbtn__icon" />
          Dashboard
        </NavLink>

        {/* 2) Salidas solicitadas (admin + manager) */}
        <NavLink
          to="/asistencia-campo"
          className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
        >
          <FaCarTunnel className="navbtn__icon" />
          Salidas solicitadas
        </NavLink>

        {/* 3) Asistencia local (solo admin) */}
        {isAdmin ? (
          <NavLink
            to="/asistencia-local"
            className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
          >
            <MdLocationPin className="navbtn__icon" />
            Asistencia Local
          </NavLink>
        ) : null}

        {/* 4) Agregar usuario (solo admin) */}
        {isAdmin ? (
          <NavLink
            to="/agregar-usuario"
            className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
          >
            <IoPersonAddSharp className="navbtn__icon" />
            Agregar Usuario
          </NavLink>
        ) : null}

        {/* 5) Salir */}
        <button type="button" className="navbtn logout" onClick={handleLogout}>
          <IoExit className="navbtn__icon" />
          Salir
        </button>
      </nav>
    </aside>
  );
}
