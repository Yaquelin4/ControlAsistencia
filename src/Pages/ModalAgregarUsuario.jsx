// src/pages/ModalAgregarUsuario.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, get, child } from "firebase/database";
import { dbAsistencia } from "../firebase";
import "../styles/modalAgregarUsuario.css";

const TYPE_LABELS = {
  op: "Olvidé picar",
  va: "Vacaciones",
  sc: "Comisión de servicio",
  pe: "Permiso ocacional",
  pa: "Personal",
};

export default function ModalAgregarUsuario({ open = false, onClose, onConfirm }) {
  const [form, setForm] = useState({
    dni: "",
    nombres: "",
    apePaterno: "",
    apeMaterno: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    managerKey: "",
    designation: "",
    allotted_office: "",
    leaves: { op: 0, va: 0, sc: 0, pe: 0, pa: 0 },
  });

  const [loadingManagers, setLoadingManagers] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [managersMap, setManagersMap] = useState({});
  const [officesMap, setOfficesMap] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        dni: "",
        nombres: "",
        apePaterno: "",
        apeMaterno: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        managerKey: "",
        designation: "",
        allotted_office: "",
        leaves: { op: 0, va: 0, sc: 0, pe: 0, pa: 0 },
      });
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    (async () => {
      setLoadingManagers(true);
      setLoadingOffices(true);
      setError("");

      const root = ref(dbAsistencia);

      try {
        const snapManagers = await get(child(root, "managers"));
        if (mounted && snapManagers.exists()) {
          const data = snapManagers.val() || {};
          setManagersMap(data);

          const keys = Object.keys(data);
          if (keys.length) {
            const firstKey = keys[0];
            const firstDesig = (data[firstKey]?.designation || "")
              .replace(/^Encargad[ao]\s+de\s*/i, "")
              .trim();

            setForm((f) => ({
              ...f,
              managerKey: f.managerKey || firstKey,
              designation: f.designation || firstDesig,
            }));
          }
        }
      } catch {
        if (mounted) setError("No se pudo cargar la lista de encargados.");
      } finally {
        if (mounted) setLoadingManagers(false);
      }

      try {
        const snapOffices = await get(child(root, "location"));
        if (mounted && snapOffices.exists()) {
          const data = snapOffices.val() || {};
          setOfficesMap(data);

          const keys = Object.keys(data);
          if (keys.length) {
            setForm((f) => ({
              ...f,
              allotted_office: f.allotted_office || keys[0],
            }));
          }
        }
      } catch {
        if (mounted) setError((prev) => prev || "No se pudo cargar las oficinas.");
      } finally {
        if (mounted) setLoadingOffices(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  const areaOptions = useMemo(() => {
    return Object.entries(managersMap).map(([key, val]) => ({
      key,
      designation: val?.designation || "",
      name: val?.name || "",
    }));
  }, [managersMap]);

  const officeOptions = useMemo(() => {
    return Object.entries(officesMap).map(([key, val]) => ({
      key,
      label: val?.name || key,
    }));
  }, [officesMap]);

  const selectedManagerName = useMemo(() => {
    if (!form.managerKey) return "";
    const m = managersMap[form.managerKey];
    return m?.name || "";
  }, [form.managerKey, managersMap]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleChangeArea = (managerKeyNuevo) => {
    const desigRaw = managersMap[managerKeyNuevo]?.designation || "";
    const desig = desigRaw.replace(/^Encargad[ao]\s+de\s*/i, "").trim();
    setForm((prev) => ({
      ...prev,
      managerKey: managerKeyNuevo,
      designation: desig,
    }));
  };

  const handleDniChange = (value) => {
    const onlyDigits = String(value).replace(/[^\d]/g, "").slice(0, 8);
    setForm((prev) => ({ ...prev, dni: onlyDigits }));
  };

  const handleLeaveInput = (type, value) => {
    let v = String(value).replace(/[^\d]/g, "");
    if (v === "") {
      setForm((prev) => ({
        ...prev,
        leaves: { ...prev.leaves, [type]: "" },
      }));
      return;
    }
    let n = parseInt(v, 10);
    if (!Number.isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 30) n = 30;
    setForm((prev) => ({
      ...prev,
      leaves: { ...prev.leaves, [type]: n },
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!form.dni || form.dni.length !== 8) return setError("El DNI debe tener 8 dígitos.");
    if (!form.nombres.trim()) return setError("Nombres es obligatorio.");
    if (!form.apePaterno.trim()) return setError("Apellido paterno es obligatorio.");
    if (!form.apeMaterno.trim()) return setError("Apellido materno es obligatorio.");
    if (!form.email.trim()) return setError("El correo es obligatorio.");
    if (!form.password.trim()) return setError("La contraseña es obligatoria.");
    if (!form.managerKey) return setError("Debes seleccionar un área (designación).");
    if (!form.designation) return setError("Debes seleccionar el área (designación).");
    if (!form.allotted_office) return setError("Debes seleccionar una oficina.");

    const Name = `${form.nombres.trim()} ${form.apePaterno.trim()} ${form.apeMaterno.trim()}`.replace(/\s+/g, " ");

    const op = Number.isFinite(parseInt(form.leaves.op)) ? parseInt(form.leaves.op) : 0;
    const va = Number.isFinite(parseInt(form.leaves.va)) ? parseInt(form.leaves.va) : 0;
    const sc = Number.isFinite(parseInt(form.leaves.sc)) ? parseInt(form.leaves.sc) : 0;
    const pe = Number.isFinite(parseInt(form.leaves.pe)) ? parseInt(form.leaves.pe) : 0;
    const pa = Number.isFinite(parseInt(form.leaves.pa)) ? parseInt(form.leaves.pa) : 0;

    try {
      await onConfirm?.({
        UUID: form.dni,
        Name,
        Email: form.email.trim(),
        Password: form.password,
        PhoneNumber: form.phone ? String(form.phone) : "",
        Address: form.address || "",
        manager: form.managerKey,
        managerName: managersMap[form.managerKey]?.name,
        designation: form.designation,
        allotted_office: form.allotted_office,
        leaves: { op, va, sc, pe, pa },
        active: true,
      });
      onClose?.();
    } catch (e2) {
      setError(e2?.message || "No se pudo crear el usuario.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Agregar usuario</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-row">
              <label>DNI</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="8 dígitos"
                value={form.dni}
                onChange={(e) => handleDniChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-row">
              <label>Teléfono</label>
              <input
                type="tel"
                placeholder="Ej.: 987654321"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Nombres</label>
              <input
                type="text"
                placeholder="Ej.: Jose"
                value={form.nombres}
                onChange={(e) => handleChange("nombres", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Apellido paterno</label>
              <input
                type="text"
                placeholder="Ej.: Quispe"
                value={form.apePaterno}
                onChange={(e) => handleChange("apePaterno", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Apellido materno</label>
              <input
                type="text"
                placeholder="Ej.: condori"
                value={form.apeMaterno}
                onChange={(e) => handleChange("apeMaterno", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Correo</label>
              <input
                type="email"
                placeholder="usuario@dominio.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
            </div>

            <div className="form-row" style={{ gridColumn: "1 / -1" }}>
              <label>Dirección</label>
              <input
                type="text"
                placeholder="Ej.: Cusco"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-row">
              <label>Designación (área)</label>
              <select
                value={form.managerKey}
                onChange={(e) => handleChangeArea(e.target.value)}
                disabled={loadingManagers || areaOptions.length === 0}
              >
                {areaOptions.length === 0 ? (
                  <option value="">(No hay áreas / managers)</option>
                ) : (
                  areaOptions.map((opt) => {
                    const cleanLabel = opt.designation
                      .replace(/^Encargad[ao]\s+de\s*/i, "")
                      .trim();
                    return (
                      <option key={opt.key} value={opt.key}>
                        {cleanLabel}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div className="form-row">
              <label>Encargado</label>
              <input type="text" value={selectedManagerName} readOnly />
            </div>
          </div>

          <div className="form-row">
            <label>Oficina</label>
            <select
              value={form.allotted_office}
              onChange={(e) => handleChange("allotted_office", e.target.value)}
              disabled={loadingOffices || officeOptions.length === 0}
            >
              {officeOptions.length === 0 ? (
                <option value="">(No hay oficinas)</option>
              ) : (
                officeOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="leave-section">
            <label>Permisos disponibles</label>

            <div className="leave-row">
              <div className="leave-item">
                <small className="subtext">{TYPE_LABELS.op}</small>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  className="leave-input"
                  value={form.leaves.op === "" ? "" : form.leaves.op}
                  onChange={(e) => handleLeaveInput("op", e.target.value)}
                />
              </div>

              <div className="leave-item">
                <small className="subtext">{TYPE_LABELS.va}</small>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  className="leave-input"
                  value={form.leaves.va === "" ? "" : form.leaves.va}
                  onChange={(e) => handleLeaveInput("va", e.target.value)}
                />
              </div>

              <div className="leave-item">
                <small className="subtext">{TYPE_LABELS.sc}</small>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  className="leave-input"
                  value={form.leaves.sc === "" ? "" : form.leaves.sc}
                  onChange={(e) => handleLeaveInput("sc", e.target.value)}
                />
              </div>

              <div className="leave-item">
                <small className="subtext">{TYPE_LABELS.pe}</small>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  className="leave-input"
                  value={form.leaves.pe === "" ? "" : form.leaves.pe}
                  onChange={(e) => handleLeaveInput("pe", e.target.value)}
                />
              </div>

              <div className="leave-item">
                <small className="subtext">{TYPE_LABELS.pa}</small>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  className="leave-input"
                  value={form.leaves.pa === "" ? "" : form.leaves.pa}
                  onChange={(e) => handleLeaveInput("pa", e.target.value)}
                />
              </div>
            </div>

            <small className="subtext">Ingrese días (enteros) entre 0 y 30.</small>
          </div>

          {error && <div className="error">{error}</div>}
        </form>

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="button" onClick={handleSubmit}>
            Crear usuario
          </button>
        </div>
      </div>
    </div>
  );
}
