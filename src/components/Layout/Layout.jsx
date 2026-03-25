// src/components/Layout/Layout.jsx
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import Sidebar from "./Sidebar";
import Header from "./Header";
import "./layout.css";

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const openMobileMenu = () => setIsMobileMenuOpen(true);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`app-layout ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        isCollapsed={isCollapsed}
        onCloseMobile={closeMobileMenu}
        onToggleCollapse={toggleCollapsed}
      />

      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={closeMobileMenu}></div>
      )}

      <main className="main-content">
        <div className="layout-mobilebar">
          {!isMobileMenuOpen && (
            <button
              type="button"
              className="menu-toggle"
              onClick={openMobileMenu}
              aria-label="Abrir menú"
            >
              <HiOutlineMenuAlt2 />
            </button>
          )}
        </div>

        <Header />

        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}