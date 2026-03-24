// src/Pages/AgregarUsuario.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, get, child } from "firebase/database";
import AttendanceTable from "../components/Table/AttendanceTable";
import ModalAgregarUsuario from "./ModalAgregarUsuario";
import { dbAsistencia } from "../firebase";

import {
  crearUsuarioCompleto,
  cambiarEstadoUsuario,
} from "../services/adminUsuariosService";

import "../styles/agregarUsuario.css";

export default function AgregarUsuario() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const [managers, setManagers] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadManagers = async () => {
      try {
        const rootRef = ref(dbAsistencia);
        const snap = await get(child(rootRef, "managers"));
        if (snap.exists()) setManagers(snap.val());
      } catch (e) {
        console.error("Error cargando managers:", e);
      }
    };
    loadManagers();
  }, []);

  const loadUsers = async () => {
    setLoadingList(true);
    try {
      const rootRef = ref(dbAsistencia);
      const snap = await get(child(rootRef, "users"));
      const list = [];

      if (snap.exists()) {
        const data = snap.val();
        Object.entries(data).forEach(([authUid, u]) => {
          list.push({
            id: authUid,
            name: u?.Name || "",
            dni: u?.UUID != null ? String(u.UUID) : "",
            uid: Number(u?.UID),
            managerCode: u?.manager || "",
            designation: u?.designation || "",
            allotted_office: u?.allotted_office || "",
            active: typeof u?.active === "boolean" ? u.active : true,
          });
        });
      }

      list.sort((a, b) => {
        const ua = Number.isFinite(a.uid) ? a.uid : 0;
        const ub = Number.isFinite(b.uid) ? b.uid : 0;
        return ub - ua;
      });

      setUsers(list);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (row) => {
    try {
      await cambiarEstadoUsuario(row.id, !row.active);
      setUsers((prev) =>
        prev.map((u) => (u.id === row.id ? { ...u, active: !u.active } : u))
      );
    } catch (err) {
      console.error("Error actualizando estado:", err);
      alert("No se pudo cambiar el estado");
    }
  };

  const handleConfirmModal = async (dataFromModal) => {
    if (creating) return;

    setCreating(true);
    try {
      const leavesPayload = {
        op:
          dataFromModal?.leaves?.op ??
          dataFromModal?.op ??
          dataFromModal?.OP ??
          0,
        va:
          dataFromModal?.leaves?.va ??
          dataFromModal?.va ??
          dataFromModal?.VA ??
          0,
        sc:
          dataFromModal?.leaves?.sc ??
          dataFromModal?.sc ??
          dataFromModal?.SC ??
          0,
        pe:
          dataFromModal?.leaves?.pe ??
          dataFromModal?.pe ??
          dataFromModal?.PE ??
          0,
        pa:
          dataFromModal?.leaves?.pa ??
          dataFromModal?.pa ??
          dataFromModal?.PA ??
          0,
      };

      await crearUsuarioCompleto({
        UUID: dataFromModal.UUID,
        Name: dataFromModal.Name,
        Email: dataFromModal.Email,
        Password: dataFromModal.Password,
        PhoneNumber: dataFromModal.PhoneNumber || "",
        Address: dataFromModal.Address || "",
        manager: dataFromModal.manager || "",
        allotted_office: dataFromModal.allotted_office || undefined,
        designation: dataFromModal.designation || undefined,
        active: dataFromModal.active ?? true,
        leaves: leavesPayload,
      });

      await loadUsers();
      setIsModalOpen(false);
      setModalKey((k) => k + 1);
    } catch (err) {
      console.error("Error creando usuario:", err);
      alert(err?.message || "No se pudo crear el usuario.");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    if (creating) return;
    setIsModalOpen(false);
    setModalKey((k) => k + 1);
  };

  const filtered = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter((u) => {
      const managerName = (u.managerCode && managers[u.managerCode]?.name) || "";
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.dni || "").toLowerCase().includes(q) ||
        (u.uid != null && String(u.uid).includes(q)) ||
        managerName.toLowerCase().includes(q)
      );
    });
  }, [users, query, managers]);

  const columns = [
    { key: "name", header: "Nombre", width: "36%" },
    { key: "dni", header: "DNI", width: "12%", align: "center" },
    { key: "uid", header: "UID", width: "10%", align: "center" },
    {
      key: "manager",
      header: "Encargado",
      width: "30%",
      render: (r) => (r.managerCode && managers[r.managerCode]?.name) || "-",
    },
    {
      key: "active",
      header: "Estado",
      width: "12%",
      align: "center",
      render: (r) => (
        <span className={`badge ${r.active ? "success" : "danger"}`}>
          {r.active ? "ACTIVO" : "NO ACTIVO"}
        </span>
      ),
    },
  ];

  const actions = (row) => (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn ghost" onClick={() => handleToggleActive(row)}>
        {row.active ? "Desactivar" : "Activar"}
      </button>
    </div>
  );

  const toolbarLeft = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        placeholder="Buscar por nombre, DNI, UID o encargado"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: 8,
          borderRadius: 6,
          border: "1px solid #e6e9ef",
          minWidth: 300,
        }}
        type="search"
      />
    </div>
  );

  const toolbarRight = (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        className="btn primary"
        onClick={() => setIsModalOpen(true)}
        disabled={creating}
      >
        {creating ? "Creando..." : "Agregar nuevo usuario"}
      </button>

      <button
        className="btn ghost"
        onClick={() => loadUsers()}
        disabled={loadingList || creating}
      >
        {loadingList ? "Cargando..." : "Actualizar lista"}
      </button>
    </div>
  );

  return (
    <div className="add-user-page">
      <div className="add-user-card">
        <h2>Usuarios</h2>
        <p className="hint">Administra el padrón de usuarios del sistema.</p>

        <AttendanceTable
          columns={columns}
          rows={filtered}
          loading={loadingList}
          emptyText="Sin usuarios"
          actions={actions}
          toolbarLeft={toolbarLeft}
          toolbarRight={toolbarRight}
          getRowKey={(r) => r.id}
          dense={false}
        />
      </div>

      <ModalAgregarUsuario
        key={modalKey}
        open={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmModal}
      />
    </div>
  );
}
