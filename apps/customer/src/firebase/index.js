// apps/customer/src/firebase/index.js
// Fix: Clear AsyncStorage when user signs out

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, runTransaction,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginWithEmail    = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);

// Fix 1: Clear AsyncStorage on logout so next user doesn't see previous queue
export const logout = async () => {
  try {
    await AsyncStorage.removeItem("activeQueue");
  } catch (e) {
    console.error("Failed to clear AsyncStorage on logout:", e);
  }
  return signOut(auth);
};

export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── Salons ────────────────────────────────────────────────────────────────────
export const getSalons = async () => {
  const snap = await getDocs(collection(db, "salons"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getSalon = async (salonId) => {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── Queue ─────────────────────────────────────────────────────────────────────

// Fix 2: Use Firestore transaction to prevent race condition on position assignment
export const joinQueue = async ({
  salonId, customerId, customerName, services,
  stylistId = null, stylistName = null,
  familyMembers = [], checkingInSelf = true, peopleCount = 1,
}) => {
  const queueRef      = collection(db, "salons", salonId, "queue");
  const totalDuration = services.reduce((s, sv) => s + (sv.durationMin || 30), 0);

  const newEntryRef = doc(queueRef);

  await runTransaction(db, async (transaction) => {
    const waitingSnap = await getDocs(
      query(queueRef, where("status", "==", "waiting"), orderBy("joinedAt"))
    );
    const position = waitingSnap.size + 1;

    transaction.set(newEntryRef, {
      customerId,
      customerName,
      services,
      stylistId,
      stylistName:      stylistName || null,
      familyMembers,
      checkingInSelf,
      peopleCount,
      status:           "waiting",
      type:             "online",
      position,
      estimatedWaitMin: (position - 1) * totalDuration,
      paymentStatus:    "pending",
      joinedAt:         serverTimestamp(),
      calledAt:         null,
      completedAt:      null,
    });
  });

  return newEntryRef;
};

export const subscribeToQueue = (salonId, callback) => {
  const q = query(
    collection(db, "salons", salonId, "queue"),
    where("status", "in", ["waiting", "called", "in-service"]),
    orderBy("position")
  );
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
};

export const subscribeToQueueEntry = (salonId, entryId, callback) =>
  onSnapshot(doc(db, "salons", salonId, "queue", entryId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });

export const updateQueueEntry = (salonId, entryId, updates) =>
  updateDoc(doc(db, "salons", salonId, "queue", entryId), {
    ...updates, updatedAt: serverTimestamp(),
  });

export const completeService = async (salonId, entryId, stylistId) => {
  const snap = await getDoc(doc(db, "salons", salonId, "queue", entryId));
  if (!snap.exists()) return;
  const entry = snap.data();

  await updateDoc(doc(db, "salons", salonId, "queue", entryId), {
    status: "done", completedAt: serverTimestamp(),
  });

  if (entry.customerId) {
    await addDoc(collection(db, "customers", entry.customerId, "visits"), {
      salonId, stylistId,
      services:      entry.services,
      familyMembers: entry.familyMembers || [],
      peopleCount:   entry.peopleCount   || 1,
      totalPrice:    entry.totalAfterDiscount
        || entry.services.reduce((s, sv) => s + (sv.price || 0), 0),
      completedAt: serverTimestamp(),
    });
  }
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomer = async (uid) => {
  const snap = await getDoc(doc(db, "customers", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveCustomer = (uid, data) =>
  setDoc(doc(db, "customers", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const getVisitHistory = async (customerId) => {
  const snap = await getDocs(
    query(collection(db, "customers", customerId, "visits"), orderBy("completedAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export { serverTimestamp };
