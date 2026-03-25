// src/components/Layout/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { MdOutlineDashboard, MdLocationPin, MdClose } from "react-icons/md";
import { FaCarTunnel } from "react-icons/fa6";
import { IoPersonAddSharp, IoExit } from "react-icons/io5";
import { TfiAngleDoubleLeft, TfiAngleDoubleRight } from "react-icons/tfi";
import { useAuth } from "../../contexts/loginContext";
import "./sidebar.css";

export default function Sidebar({
  isMobileOpen,
  isCollapsed,
  onCloseMobile,
  onToggleCollapse,
}) {
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
    ? "PANEL DEL ADMINISTRADOR"
    : isManager
      ? "PANEL: ENCARGADO DE AREA"
      : "PANEL: VISTA ";

  return (
    <aside
      className={`sidebar ${isMobileOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}
    >
      <div className="sidebar__top">
        <div className="sidebar__role-wrap">
          {!isCollapsed && (
            <div className="sidebar__role">
              {panelTitle}
              {isManager && managerCode ? (
                <div className="sidebar__subrole">{managerCode}</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="sidebar__actions">
          <button
            type="button"
            className="sidebar__collapse desktop-only"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Abrir barra lateral" : "Cerrar barra lateral"}
            title={isCollapsed ? "Abrir barra lateral" : "Cerrar barra lateral"}
          >
            {isCollapsed ? <TfiAngleDoubleRight /> : <TfiAngleDoubleLeft />}
          </button>

          <button
            type="button"
            className="sidebar__close mobile-only"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
          >
            <MdClose />
          </button>
        </div>
      </div>

      <nav className="sidebar__nav">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
          onClick={onCloseMobile}
        >
          <MdOutlineDashboard className="navbtn__icon" />
          {!isCollapsed && <span>Dashboard</span>}
        </NavLink>

        <NavLink
          to="/asistencia-campo"
          className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
          onClick={onCloseMobile}
        >
          <FaCarTunnel className="navbtn__icon" />
          {!isCollapsed && <span>Salidas solicitadas</span>}
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/asistencia-local"
            className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
            onClick={onCloseMobile}
          >
            <MdLocationPin className="navbtn__icon" />
            {!isCollapsed && <span>Asistencia Local</span>}
          </NavLink>
        )}

        {isAdmin && (
          <NavLink
            to="/agregar-usuario"
            className={({ isActive }) => (isActive ? "navbtn active" : "navbtn")}
            onClick={onCloseMobile}
          >
            <IoPersonAddSharp className="navbtn__icon" />
            {!isCollapsed && <span>Agregar Usuario</span>}
          </NavLink>
        )}

        <button type="button" className="navbtn logout" onClick={handleLogout}>
          <IoExit className="navbtn__icon" />
          {!isCollapsed && <span>Salir</span>}
        </button>
      </nav>
    </aside>
  );
}