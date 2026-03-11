// packages/shared/firebase/index.js
// Centralised Firebase initialisation used by both apps.

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  GeoPoint,
} from "firebase/firestore";
import { firebaseConfig } from "./config";

// Initialise only once (important for hot-reloading in Expo)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// ─── Salon helpers ────────────────────────────────────────────────────────────

/** Fetch all salons (optionally filtered by city) */
export const getSalons = async (city = null) => {
  const ref = collection(db, "salons");
  const q   = city ? query(ref, where("city", "==", city)) : query(ref);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Fetch a single salon by ID */
export const getSalon = async (salonId) => {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/** Create or update a salon document */
export const saveSalon = (salonId, data) =>
  setDoc(doc(db, "salons", salonId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

// ─── Queue helpers ────────────────────────────────────────────────────────────

/**
 * Add a customer to a salon's queue.
 * Returns the new QueueEntry document reference.
 */
export const joinQueue = async ({ salonId, customerId, customerName, services, stylistId = null }) => {
  const queueRef = collection(db, "salons", salonId, "queue");

  // Count current waiting entries to assign position
  const waitingSnap = await getDocs(
    query(queueRef, where("status", "==", "waiting"), orderBy("joinedAt"))
  );
  const position = waitingSnap.size + 1;

  const entry = {
    customerId,
    customerName,
    services,          // array of { serviceId, name, durationMin, price }
    stylistId,
    status: "waiting", // waiting | called | in-service | done | no-show
    type: "online",    // online | walk-in
    position,
    joinedAt: serverTimestamp(),
    calledAt: null,
    completedAt: null,
    estimatedWaitMin: position * averageServiceDuration(services),
  };

  return addDoc(queueRef, entry);
};

/** Add a walk-in entry (created by salon staff) */
export const addWalkIn = ({ salonId, customerName, services, stylistId = null }) =>
  joinQueue({ salonId, customerId: null, customerName, services, stylistId, type: "walk-in" });

/** Listen to the live queue for a salon (real-time) */
export const subscribeToQueue = (salonId, callback) => {
  const q = query(
    collection(db, "salons", salonId, "queue"),
    where("status", "in", ["waiting", "called", "in-service"]),
    orderBy("position")
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(entries);
  });
};

/** Listen to a single queue entry (for the customer's live tracker) */
export const subscribeToQueueEntry = (salonId, entryId, callback) =>
  onSnapshot(doc(db, "salons", salonId, "queue", entryId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });

/** Update queue entry status */
export const updateQueueEntry = (salonId, entryId, updates) =>
  updateDoc(doc(db, "salons", salonId, "queue", entryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

/** Call the next customer */
export const callNextCustomer = async (salonId) => {
  const q = query(
    collection(db, "salons", salonId, "queue"),
    where("status", "==", "waiting"),
    orderBy("position")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const next = snap.docs[0];
  await updateQueueEntry(salonId, next.id, {
    status: "called",
    calledAt: serverTimestamp(),
  });
  return { id: next.id, ...next.data() };
};

/** Mark an entry as complete and record visit history */
export const completeService = async (salonId, entryId, stylistId) => {
  const entryRef = doc(db, "salons", salonId, "queue", entryId);
  const entrySnap = await getDoc(entryRef);
  if (!entrySnap.exists()) return;

  const entry = entrySnap.data();

  // Mark done in queue
  await updateDoc(entryRef, {
    status: "done",
    completedAt: serverTimestamp(),
  });

  // Save to visit history (if customer is logged in)
  if (entry.customerId) {
    await addDoc(collection(db, "customers", entry.customerId, "visits"), {
      salonId,
      stylistId,
      services: entry.services,
      totalPrice: entry.services.reduce((sum, s) => sum + s.price, 0),
      completedAt: serverTimestamp(),
    });
  }
};

// ─── Customer helpers ─────────────────────────────────────────────────────────

export const getCustomer = async (uid) => {
  const snap = await getDoc(doc(db, "customers", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveCustomer = (uid, data) =>
  setDoc(doc(db, "customers", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const getVisitHistory = async (customerId) => {
  const snap = await getDocs(
    query(
      collection(db, "customers", customerId, "visits"),
      orderBy("completedAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Average duration of selected services in minutes */
export const averageServiceDuration = (services = []) => {
  if (!services.length) return 30; // default 30 min
  const total = services.reduce((sum, s) => sum + (s.durationMin || 30), 0);
  return Math.round(total / services.length);
};

export { serverTimestamp, GeoPoint };
