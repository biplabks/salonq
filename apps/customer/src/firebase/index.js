// apps/customer/src/firebase/config.js
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
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

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
export const db = getFirestore(app);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── Salons ────────────────────────────────────────────────────────────────────
export const getSalons = async () => {
  const snap = await getDocs(collection(db, "salons"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeSalons = (callback) => {
  let salons = [];
  let queueCounts = {};

  const merge = () =>
    callback(salons.map((s) => ({ ...s, queueCount: queueCounts[s.id] ?? s.queueCount ?? 0 })));

  const unsubSalons = onSnapshot(collection(db, "salons"), (snap) => {
    salons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    merge();
  });

  const unsubQueue = onSnapshot(
    query(collectionGroup(db, "queue"), where("status", "==", "waiting")),
    (snap) => {
      const counts = {};
      snap.docs.forEach((d) => {
        const salonId = d.ref.parent.parent.id;
        counts[salonId] = (counts[salonId] || 0) + 1;
      });
      queueCounts = counts;
      merge();
    }
  );

  return () => { unsubSalons(); unsubQueue(); };
};

export const getSalon = async (salonId) => {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveSalon = (salonId, data) =>
  setDoc(doc(db, "salons", salonId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

// ── Queue ─────────────────────────────────────────────────────────────────────
export const joinQueue = async ({ salonId, customerId, customerName, services, stylistId = null }) => {
  const queueRef = collection(db, "salons", salonId, "queue");
  const waitingSnap = await getDocs(
    query(queueRef, where("status", "==", "waiting"))
  );
  const position = waitingSnap.size + 1;
  const totalDuration = services.reduce((s, sv) => s + (sv.durationMin || 30), 0);

  return addDoc(queueRef, {
    customerId,
    customerName,
    services,
    stylistId,
    status: "waiting",
    type: "online",
    position,
    estimatedWaitMin: (position - 1) * totalDuration,
    joinedAt: serverTimestamp(),
    calledAt: null,
    completedAt: null,
  });
};

export const subscribeToQueue = (salonId, callback) => {
  const q = query(
    collection(db, "salons", salonId, "queue"),
    where("status", "in", ["waiting", "called", "in-service"])
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    callback(entries);
  });
};

export const subscribeToQueueEntry = (salonId, entryId, callback) =>
  onSnapshot(doc(db, "salons", salonId, "queue", entryId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });

export const updateQueueEntry = (salonId, entryId, updates) =>
  updateDoc(doc(db, "salons", salonId, "queue", entryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

export const completeService = async (salonId, entryId, stylistId) => {
  const entrySnap = await getDoc(doc(db, "salons", salonId, "queue", entryId));
  if (!entrySnap.exists()) return;
  const entry = entrySnap.data();

  await updateDoc(doc(db, "salons", salonId, "queue", entryId), {
    status: "done",
    completedAt: serverTimestamp(),
  });

  if (entry.customerId) {
    await addDoc(collection(db, "customers", entry.customerId, "visits"), {
      salonId,
      stylistId,
      services: entry.services,
      totalPrice: entry.services.reduce((s, sv) => s + sv.price, 0),
      completedAt: serverTimestamp(),
    });
  }
};

export const callNextCustomer = async (salonId) => {
  const snap = await getDocs(
    query(
      collection(db, "salons", salonId, "queue"),
      where("status", "==", "waiting"),
      orderBy("position")
    )
  );
  if (snap.empty) return null;
  const next = snap.docs[0];
  await updateQueueEntry(salonId, next.id, { status: "called", calledAt: serverTimestamp() });
  return { id: next.id, ...next.data() };
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

// ── Utils ─────────────────────────────────────────────────────────────────────
export { serverTimestamp, addDoc, collection, db as firestore };
