// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import SessionGuard from "./components/SessionGuard";

import Dashboard from "./Pages/Dashboard.jsx";
import AsistenciaCampo from "./Pages/AsistenciaCampo.jsx";
import AsistenciaLocal from "./Pages/AsistenciaLocal.jsx";
import AgregarUsuario from "./Pages/AgregarUsuario.jsx";
import Login from "./Pages/Login.jsx";

export default function App() {
  return (
    
    <SessionGuard>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="asistencia-campo" element={<AsistenciaCampo />} />

          <Route
            path="asistencia-local"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/dashboard">
                <AsistenciaLocal />
              </ProtectedRoute>
            }
          />

          <Route
            path="agregar-usuario"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/dashboard">
                <AgregarUsuario />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </SessionGuard>
  );
}