// src/services/authService.js
// Servicio  para autenticación 
const STORAGE_KEY = "myapp_user";

export const authService = {
  // devuelve el usuario actual (o null)
  current() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // login sin restricciones: guarda lo que el usuario ingrese
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

  // logout
  async logout() {
    localStorage.removeItem(STORAGE_KEY);
    if (typeof this._onAuthChanged === "function") {
      this._onAuthChanged(null);
    }
  },

  // suscripción opcional
  onAuthStateChanged(cb) {
    this._onAuthChanged = cb;
    return () => {
      if (this._onAuthChanged === cb) this._onAuthChanged = null;
    };
  }
};
