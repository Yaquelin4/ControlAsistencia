// src/services/asistenciaLocalService.js
// Servicio para normalizar los datos de Attendance (RTDB)
import { ref, get, child } from "firebase/database";
import { dbAsistencia as dbLocal } from "../firebase";
import { registerLocale } from "react-datepicker";
import es from "date-fns/locale/es";

registerLocale("es", es);

/** parse "dd-mm-yyyy" to {yyyy,mm,dd} */
function parseDMYParts(dmy) {
  if (!dmy || typeof dmy !== "string") return null;
  const parts = dmy.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  return { dd, mm, yyyy };
}

/** Combina fecha "dd-mm-yyyy" y hora "HH:MM:SS" a objeto Date */
function makeDateFromParts(dmy, timeStr) {
  const p = parseDMYParts(dmy);
  if (!p) return null;

  const safeTime = String(timeStr || "00:00:00");
  const [hh, min, ss] = safeTime.split(":").map((n) => parseInt(n, 10));

  return new Date(p.yyyy, p.mm - 1, p.dd, hh || 0, min || 0, ss || 0);
}

/**
 * Normaliza la estructura Attendance en filas emparejadas.
 * Devuelve filas:
 *  {
 *    id, usuario, userId,
 *    fecha: "dd-mm-yyyy" (para que tu UI por día funcione),
 *    fechaRaw: "dd-mm-yyyy",
 *    entrada, salida,
 *    oficinaEntrada, oficinaSalida,
 *    observaciones, durationMinutes
 *  }
 */
export async function fetchLocalAttendance({ month = null } = {}) {
  const root = ref(dbLocal);

  const [attSnap, usersSnap] = await Promise.all([
    get(child(root, "Attendance")),
    get(child(root, "users")),
  ]);

  const attendance = attSnap.exists() ? attSnap.val() : {};
  const users = usersSnap.exists() ? usersSnap.val() : {};

  const rows = [];

  Object.entries(attendance).forEach(([userId, datesObj]) => {
    const userName =
      users && users[userId] && users[userId].Name ? users[userId].Name : userId;

    Object.entries(datesObj || {}).forEach(([dateStr, eventsObj]) => {
      // filtro por mes si se indicó (month 1..12)
      if (month && month >= 1 && month <= 12) {
        const parts = parseDMYParts(dateStr);
        if (!parts) return;
        if (parts.mm !== Number(month)) return;
      }

      const events = Object.entries(eventsObj || {})
        .map(([key, val]) => {
          // key: "in-10:51:46" o "out-11:08:25"
          const firstDash = key.indexOf("-");
          const rawType = firstDash >= 0 ? key.slice(0, firstDash) : key;
          const rawTime = firstDash >= 0 ? key.slice(firstDash + 1) : "";

          const t = String(rawType || "").toLowerCase();
          const type = t === "in" ? "in" : "out";

          // En tu RTDB suele venir val.time, si no, caemos al tiempo del key
          const timeStr = val?.time || rawTime || "";
          const office = val?.office || "";

          const sortDate = makeDateFromParts(dateStr, timeStr);

          return {
            rawKey: key,
            type,
            timeStr,
            office,
            dateStr,
            sortDate,
          };
        })
        .filter((e) => e.sortDate);

      // ordenar por hora ascendente
      events.sort((a, b) => a.sortDate - b.sortDate);

      // Emparejar: tomar un `in` y el siguiente `out`
      let pendingIn = null;
      let pairIndex = 0;

      events.forEach((ev) => {
        if (ev.type === "in") {
          // Si ya había un IN pendiente, lo cerramos como incompleto (sin OUT)
          if (pendingIn) {
            rows.push({
              id: `${userId}_${dateStr}_pair_${pairIndex++}`,
              usuario: userName,
              userId,
              fecha: dateStr,     // IMPORTANTE: dd-mm-yyyy (UI por día)
              fechaRaw: dateStr,

              entrada: pendingIn.timeStr || null,
              salida: null,
              oficinaEntrada: pendingIn.office || "",
              oficinaSalida: null,
              observaciones: "Salida no registrada",
              durationMinutes: 0,
            });
          }
          pendingIn = ev;
          return;
        }

        // ev.type === "out"
        if (pendingIn) {
          const startDate = makeDateFromParts(dateStr, pendingIn.timeStr);
          const endDate = makeDateFromParts(dateStr, ev.timeStr);

          let durationMinutes = 0;
          if (startDate && endDate && endDate > startDate) {
            durationMinutes = Math.round((endDate - startDate) / 60000);
          }

          rows.push({
            id: `${userId}_${dateStr}_pair_${pairIndex++}`,
            usuario: userName,
            userId,
            fecha: dateStr,     // dd-mm-yyyy
            fechaRaw: dateStr,

            entrada: pendingIn.timeStr || null,
            salida: ev.timeStr || null,
            oficinaEntrada: pendingIn.office || "",
            oficinaSalida: ev.office || "",
            observaciones: "",
            durationMinutes,
          });

          pendingIn = null;
        } else {
          // OUT sin IN previo
          rows.push({
            id: `${userId}_${dateStr}_pair_${pairIndex++}`,
            usuario: userName,
            userId,
            fecha: dateStr,     // dd-mm-yyyy
            fechaRaw: dateStr,

            entrada: null,
            salida: ev.timeStr || null,
            oficinaEntrada: null,
            oficinaSalida: ev.office || "",
            observaciones: "Entrada no registrada",
            durationMinutes: 0,
          });
        }
      });

      // Si quedó un IN pendiente
      if (pendingIn) {
        rows.push({
          id: `${userId}_${dateStr}_pair_${pairIndex++}`,
          usuario: userName,
          userId,
          fecha: dateStr,     // dd-mm-yyyy
          fechaRaw: dateStr,

          entrada: pendingIn.timeStr || null,
          salida: null,
          oficinaEntrada: pendingIn.office || "",
          oficinaSalida: null,
          observaciones: "Salida no registrada",
          durationMinutes: 0,
        });
        pendingIn = null;
      }
    });
  });

  // ordenar por fecha/hora desc, luego usuario
  rows.sort((a, b) => {
    const aDateStr = a.fechaRaw || a.fecha;
    const bDateStr = b.fechaRaw || b.fecha;

    const aDate = a.entrada
      ? makeDateFromParts(aDateStr, a.entrada)
      : a.salida
      ? makeDateFromParts(aDateStr, a.salida)
      : new Date(0);

    const bDate = b.entrada
      ? makeDateFromParts(bDateStr, b.entrada)
      : b.salida
      ? makeDateFromParts(bDateStr, b.salida)
      : new Date(0);

    const diff = bDate - aDate;
    if (diff !== 0) return diff;

    const au = String(a.usuario || "");
    const bu = String(b.usuario || "");
    return au.localeCompare(bu);
  });

  return rows;
}
