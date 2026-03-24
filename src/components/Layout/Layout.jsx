// src/components/Layout/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import "./layout.css"; 

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Header />
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
