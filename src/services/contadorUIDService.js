// src/services/contadorUIDService.js
import { ref, runTransaction, get, child } from "firebase/database";
import { dbAsistencia } from "../firebase";

/**
 * Lee el lastUID actual (o null si no existe)
 */
export async function leerLastUID() {
  const snap = await get(child(ref(dbAsistencia), "config/lastUID"));
  return snap.exists() ? Number(snap.val()) : null;
}

/**
 * Devuelve el siguiente UID de forma transaccional.
 * - Si no existe o es < 99, arranca desde 99 -> el siguiente será 100.
 * - Siempre incrementa en 1 y retorna el valor resultante (100, 101, 102, ...)
 */
export async function obtenerSiguienteUID() {
  const targetRef = ref(dbAsistencia, "config/lastUID");
  const result = await runTransaction(targetRef, (current) => {
    let cur = Number(current);
    if (!Number.isFinite(cur) || cur < 99) cur = 99; // arranque seguro
    return cur + 1;
  });
  if (!result.committed) {
    throw new Error("No se pudo obtener el siguiente UID (transaction aborted).");
  }
  return Number(result.snapshot.val()); // p.ej. 100, 101...
}
