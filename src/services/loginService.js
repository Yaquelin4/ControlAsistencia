// src/services/loginService.js
// Servicio de autenticación: wrapper que puede usar Firebase si está disponible.
// Mantiene compatibilidad con la versión simple local.

import { auth, signInWithGooglePopup, signOut as firebaseSignOut, fetchAllowedEmailsFromDB } from "../firebase";
import { onAuthStateChanged as firebaseOnAuthStateChanged } from "firebase/auth";

const STORAGE_KEY = "myapp_user";

export const loginService = {
  // devuelve el usuario actual (o null)
  current() {
    try {
      // si Firebase está inicializado y hay user:
      if (auth && auth.currentUser) {
        const u = auth.currentUser;
        return {
          uid: u.uid,
          email: u.email,
          username: u.displayName || u.email,
          photoURL: u.photoURL || null,
          providerData: u.providerData || null,
        };
      }
      // fallback localStorage:
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // login local (mantengo para compatibilidad/desarrollo)
  async login(username, password) {
    const user = {
      uid: "user-" + Date.now(),
      username,
      email: username,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    if (typeof this._onAuthChanged === "function") {
      this._onAuthChanged(user);
    }
    return user;
  },

  // google login real (usa Firebase)
  async googleLogin() {
    if (!signInWithGooglePopup) {
      throw new Error("Firebase signInWithGooglePopup no disponible");
    }
    const res = await signInWithGooglePopup();
    // onAuthStateChanged se encargará de notificar el cambio
    return res;
  },

  // logout: intenta Firebase, si no usa localStorage
  async logout() {
    try {
      if (firebaseSignOut) {
        await firebaseSignOut();
      }
    } catch (e) {
      console.warn("firebaseSignOut falló:", e);
    }
    localStorage.removeItem(STORAGE_KEY);
    if (typeof this._onAuthChanged === "function") {
      this._onAuthChanged(null);
    }
  },

  // suscripción: si existe Firebase, la suscripción la hace aquí
  onAuthStateChanged(cb) {
    this._onAuthChanged = cb;

    // si Firebase está disponible, use su onAuthStateChanged para mantener sync
    let unsubFirebase = null;
    if (auth && typeof firebaseOnAuthStateChanged === "function") {
      unsubFirebase = firebaseOnAuthStateChanged(auth, (u) => {
        const mapped = u
          ? {
              uid: u.uid,
              email: u.email,
              username: u.displayName || u.email,
              photoURL: u.photoURL || null,
              providerData: u.providerData || null,
            }
          : null;
        if (typeof this._onAuthChanged === "function") this._onAuthChanged(mapped);
      });
    }

    // Retornar cleanup
    return () => {
      this._onAuthChanged = null;
      if (typeof unsubFirebase === "function") unsubFirebase();
    };
  },

  // leer whitelist desde DB
  async fetchAllowedEmails() {
    return fetchAllowedEmailsFromDB();
  }
};
