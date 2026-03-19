// apps/salon/src/firebase/index.js
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app      = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth      = getAuth(app);
export const firestore = getFirestore(app);
export const db        = firestore;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginWithEmail    = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const logout            = () => signOut(auth);
export const onAuthChange      = (cb) => onAuthStateChanged(auth, cb);

// ── Staff → Salon linking ─────────────────────────────────────────────────────

/** Get the salon linked to a staff member's uid */
export const getStaffSalon = async (uid) => {
  const snap = await getDoc(doc(firestore, "salonStaff", uid));
  if (!snap.exists()) return null;
  const { salonId } = snap.data();
  if (!salonId) return null;
  return getSalon(salonId);
};

/** Link a staff member to a salon */
export const linkStaffToSalon = (uid, salonId, email) =>
  setDoc(doc(firestore, "salonStaff", uid), {
    salonId,
    email,
    role:      "owner",
    createdAt: serverTimestamp(),
  });

// ── Salons ────────────────────────────────────────────────────────────────────
export const getSalon = async (salonId) => {
  const snap = await getDoc(doc(firestore, "salons", salonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveSalon = (salonId, data) =>
  setDoc(doc(firestore, "salons", salonId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

/** Create a brand new salon and link it to the staff member */
export const createSalon = async (uid, email, salonData) => {
  const salonRef = await addDoc(collection(firestore, "salons"), {
    ...salonData,
    queueCount: 0,
    avgWaitMin:  0,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
  });
  await linkStaffToSalon(uid, salonRef.id, email);
  return salonRef.id;
};

// ── Queue ─────────────────────────────────────────────────────────────────────
export const subscribeToQueue = (salonId, callback) => {
  const q = query(
    collection(firestore, "salons", salonId, "queue"),
    where("status", "in", ["waiting", "called", "in-service"])
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    callback(entries);
  });
};

export const updateQueueEntry = (salonId, entryId, updates) =>
  updateDoc(doc(firestore, "salons", salonId, "queue", entryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

export const completeService = async (salonId, entryId, stylistId) => {
  const snap = await getDoc(doc(firestore, "salons", salonId, "queue", entryId));
  if (!snap.exists()) return;
  const entry = snap.data();
  await updateDoc(doc(firestore, "salons", salonId, "queue", entryId), {
    status: "done", completedAt: serverTimestamp(),
  });
  if (entry.customerId) {
    await addDoc(collection(firestore, "customers", entry.customerId, "visits"), {
      salonId, stylistId,
      services:   entry.services,
      totalPrice: entry.totalAfterDiscount || entry.services.reduce((s, sv) => s + sv.price, 0),
      completedAt: serverTimestamp(),
    });
  }
};

// ── Re-exports ────────────────────────────────────────────────────────────────
export { serverTimestamp, addDoc, collection, doc, onSnapshot, getDocs, query, where, orderBy, writeBatch };