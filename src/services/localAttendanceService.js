// src/services/localAttendanceService.js
// Servicio para normalizar los datos de Attendance (RTDB)
import { ref, get, child } from "firebase/database";
import { dbAsistencia as dbLocal } from "../firebase"; // tu archivo es src/firebase.js que exporta `db`

/** parse "dd-mm-yyyy" to {yyyy,mm,dd} */
function parseDMYParts(dmy) {
  if (!dmy) return null;
  const parts = dmy.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return { dd, mm, yyyy };
}

/** Combina fecha "dd-mm-yyyy" y hora "HH:MM:SS" a objeto Date */
function makeDateFromParts(dmy, timeStr) {
  const p = parseDMYParts(dmy);
  if (!p) return null;
  const [hh, min, ss] = (timeStr || "00:00:00").split(":").map((n) => parseInt(n, 10));
  return new Date(p.yyyy, p.mm - 1, p.dd, hh || 0, min || 0, ss || 0);
}

/** Normaliza la estructura Attendance en filas emparejadas */
export async function fetchLocalAttendance({ month = null } = {}) {
  // lee Attendance y users
  const root = ref(dbLocal);
  const [attSnap, usersSnap] = await Promise.all([
    get(child(root, "Attendance")),
    get(child(root, "users")),
  ]);

  const attendance = attSnap.exists() ? attSnap.val() : {};
  const users = usersSnap.exists() ? usersSnap.val() : {};

  const rows = [];

  // attendance: { userId: { "25-08-2025": { "in-10:51:46": { office, time }, "out-11:08:25": {...}} } }
  Object.entries(attendance).forEach(([userId, datesObj]) => {
    const userName = (users && users[userId] && users[userId].Name) ? users[userId].Name : userId;

    Object.entries(datesObj).forEach(([dateStr, eventsObj]) => {
      // filtro por mes si se indicó (month 1..12)
      if (month && month >= 1 && month <= 12) {
        const parts = parseDMYParts(dateStr);
        if (!parts) return;
        if (parts.mm !== Number(month)) return;
      }

      // Convertir eventos a array con tipo (in/out), time, office, rawKey
      const events = Object.entries(eventsObj).map(([key, val]) => {
        // key: "in-10:51:46" or "out-11:08:25"
        const [type, timeStr] = key.split("-");
        return {
          rawKey: key,
          type: type?.toLowerCase() === "in" ? "in" : "out",
          timeStr: val?.time || timeStr || "",
          office: val?.office || "",
          dateStr,
          sortDate: makeDateFromParts(dateStr, val?.time || timeStr),
        };
      }).filter(e => e.sortDate); // eliminar si no se pudo parsear

      // ordenar por hora ascendente
      events.sort((a, b) => a.sortDate - b.sortDate);

      // Emparejar: recorrer eventos, tomar un `in` y buscar el siguiente `out`
      let pendingIn = null;
      let pairIndex = 0;

      events.forEach((ev) => {
        if (ev.type === "in") {
          // si hay un pendingIn sin out, guardarlo como no registrado antes de reasignar
          if (pendingIn) {
            rows.push({
              id: `${userId}_${dateStr}_pair_${pairIndex++}`,
              usuario: userName,
              userId,
              fecha: dateStr,
              entrada: pendingIn.timeStr || null,
              salida: null,
              oficinaEntrada: pendingIn.office || "",
              oficinaSalida: null,
              observaciones: "Salida no registrada",
            });
            // continuar: set pendingIn al actual ev
            pendingIn = ev;
          } else {
            pendingIn = ev;
          }
        } else if (ev.type === "out") {
          if (pendingIn) {
            // emparejar pendingIn con este out
            rows.push({
              id: `${userId}_${dateStr}_pair_${pairIndex++}`,
              usuario: userName,
              userId,
              fecha: dateStr,
              entrada: pendingIn.timeStr || null,
              salida: ev.timeStr || null,
              oficinaEntrada: pendingIn.office || "",
              oficinaSalida: ev.office || "",
              observaciones: "",
            });
            pendingIn = null;
          } else {
            // out sin in previo -> registramos como entrada no registrada
            rows.push({
              id: `${userId}_${dateStr}_pair_${pairIndex++}`,
              usuario: userName,
              userId,
              fecha: dateStr,
              entrada: null,
              salida: ev.timeStr || null,
              oficinaEntrada: null,
              oficinaSalida: ev.office || "",
              observaciones: "Entrada no registrada",
            });
          }
        }
      });

      // Si quedó pendingIn sin out al final -> declarar salida no registrada
      if (pendingIn) {
        rows.push({
          id: `${userId}_${dateStr}_pair_${pairIndex++}`,
          usuario: userName,
          userId,
          fecha: dateStr,
          entrada: pendingIn.timeStr || null,
          salida: null,
          oficinaEntrada: pendingIn.office || "",
          oficinaSalida: null,
          observaciones: "Salida no registrada",
        });
        pendingIn = null;
      }
    });
  });

  // ordenar por fecha desc, usuario
  rows.sort((a, b) => {
    // parse fecha+hora de entrada preferible; si no hay entrada use salida
    const aDate = a.entrada ? makeDateFromParts(a.fecha, a.entrada) : (a.salida ? makeDateFromParts(a.fecha, a.salida) : new Date(0));
    const bDate = b.entrada ? makeDateFromParts(b.fecha, b.entrada) : (b.salida ? makeDateFromParts(b.fecha, b.salida) : new Date(0));
    if (bDate - aDate !== 0) return bDate - aDate;
    if (a.usuario < b.usuario) return -1;
    if (a.usuario > b.usuario) return 1;
    return 0;
  });

  return rows;
}
