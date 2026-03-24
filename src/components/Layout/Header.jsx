// src/components/Layout/Header.jsx
import React from "react";
import { useAuth } from "../../contexts/loginContext";
import "./header.css";

export default function Header({ title = "REGISTRO Y CONTROL DE ASISTENCIA" }) {
  const { user, role, managerCode } = useAuth();

  const email = user?.email || "Usuario no identificado";

  // Texto según el rol
  let roleLabel = "Solo Visualizaciones";

  if (role === "admin") {
    roleLabel = "Administrador";
  } else if (role === "manager") {
    // managerCode viene tipo "manager3", "manager2", etc.
    if (managerCode) {
      // extraemos el número para mostrar "Manager 3"
      const num = String(managerCode).replace("manager", "");
      roleLabel = `Manager ${num}`;
    } else {
      roleLabel = "Manager";
    }
  }

  return (
    <header className="header">
      <div className="header__left"></div>

      <div className="header__center">
        <h1 className="header__title">{title}</h1>
      </div>

      <div className="header__right">
        <div className="userbox">
          <div className="user-info">
            <div className="user-name">{email}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <div className="userbox__avatar" />
        </div>
      </div>
    </header>
  );
}
