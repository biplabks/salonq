// apps/salon/src/firebase/index.js
import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth, browserLocalPersistence, getAuth,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, addDoc, query, where, onSnapshot, serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCCuChyLpT8JhRpnEoyZnkJqzwzmbMKNlo",
  authDomain:        "salonq-5c956.firebaseapp.com",
  projectId:         "salonq-5c956",
  storageBucket:     "salonq-5c956.firebasestorage.app",
  messagingSenderId: "660759026876",
  appId:             "1:660759026876:web:a9ba777175c0bf5abc84b9",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
let _auth;
try {
  _auth = initializeAuth(app, { persistence: browserLocalPersistence });
} catch {
  _auth = getAuth(app);
}
export const auth = _auth;
export const firestore = getFirestore(app);

// keep "db" as alias so existing code still works
export const db = firestore;

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);
export const logout    = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export const getSalon = async (salonId) => {
  const snap = await getDoc(doc(firestore, "salons", salonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveSalon = (salonId, data) =>
  setDoc(
    doc(firestore, "salons", salonId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );

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
    status:      "done",
    completedAt: serverTimestamp(),
  });

  if (entry.customerId) {
    await addDoc(collection(firestore, "customers", entry.customerId, "visits"), {
      salonId,
      stylistId,
      services:   entry.services,
      totalPrice: entry.services.reduce((s, sv) => s + sv.price, 0),
      completedAt: serverTimestamp(),
    });
  }
};

// Re-export firebase primitives needed by screens
export { serverTimestamp, addDoc, collection, doc, onSnapshot };