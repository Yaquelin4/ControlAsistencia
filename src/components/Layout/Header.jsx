import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/loginContext";
import "./header.css";

const TITLES_BY_PATH = {
  "/dashboard": "DASHBOARD",
  "/asistencia-campo": "SALIDAS SOLICITADAS",
  "/asistencia-local": "ASISTENCIA LOCAL",
  "/agregar-usuario": "AGREGAR USUARIO",
};

export default function Header() {
  const { user, role, managerCode } = useAuth();
  const location = useLocation();

  const email = user?.email || "Usuario no identificado";

  let roleLabel = "Solo Visualizaciones";

  if (role === "admin") {
    roleLabel = "Administrador";
  } else if (role === "manager") {
    if (managerCode) {
      const num = String(managerCode).replace("manager", "");
      roleLabel = `Manager ${num}`;
    } else {
      roleLabel = "Manager";
    }
  }

  const title =
    TITLES_BY_PATH[location.pathname] || "REGISTRO Y CONTROL DE ASISTENCIA";

  return (
    <header className="header">
      <div className="header__center">
        <h1 className="header__title">{title}</h1>
      </div>

      <div className="header__right">
        <div className="userbox">
          <div className="user-info">
            <div className="user-name" title={email}>
              {email}
            </div>
            <div className="user-role">{roleLabel}</div>
          </div>

          <div className="userbox__avatar">
            <img src="/avatar.jpg" alt="Avatar de usuario" />
          </div>
        </div>
      </div>
    </header>
  );
}