// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword, 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBJwUD09-69FQ3NWcPOQu8smofKXvuwDek",
  authDomain: "geoflix-asistencia.firebaseapp.com",
  databaseURL: "https://geoflix-asistencia-default-rtdb.firebaseio.com",
  projectId: "geoflix-asistencia",
  storageBucket: "geoflix-asistencia.firebasestorage.app",
  messagingSenderId: "677586350027",
  appId: "1:677586350027:web:f726b101ee37dffab2d04e",
  measurementId: "G-E80HVPPBTR",
};

// App principal (tu sesión actual)
const app = initializeApp(firebaseConfig);
// App secundaria SOLO para crear cuentas sin alterar tu sesión
const adminApp = initializeApp(firebaseConfig, "adminApp");

// RTDB
export const dbAsistencia = getDatabase(app);

// Auth principal
export const auth = getAuth(app);
setPersistence(auth, inMemoryPersistence);

// Auth secundario (para crear usuarios sin cerrar tu sesión)
export const adminAuth = getAuth(adminApp);
setPersistence(adminAuth, inMemoryPersistence);

// Google provider
const googleProvider = new GoogleAuthProvider();

// Login con popup de Google
export async function signInWithGooglePopup() {
  // devolvemos el result completo (onAuthStateChanged se encarga después)
  return await signInWithPopup(auth, googleProvider);
}

// Login con email/contraseña (usuarios creados en Authentication)
export async function signInWithEmailPass(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user; // devuelve el usuario de Firebase
}

// Cerrar sesión
export async function signOut() {
  await fbSignOut(auth);
}
