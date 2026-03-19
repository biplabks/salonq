// apps/salon/src/utils/waitTimeEngine.js
import {
  collection, getDocs, query, where,
  writeBatch, doc, updateDoc,
} from "firebase/firestore";
import { firestore, serverTimestamp } from "../firebase";

/**
 * Recalculate positions, wait times for all waiting customers
 * AND update salon's queueCount + avgWaitMin.
 *
 * Call this after every: done, no-show, start-service, walk-in added.
 */
export const recalculateQueue = async (salonId, availableStylists = 1) => {
  const queueRef = collection(firestore, "salons", salonId, "queue");

  // No orderBy here — sort client-side to avoid Firestore composite index requirement
  const snap = await getDocs(
    query(queueRef, where("status", "in", ["waiting", "called", "in-service"]))
  );

  const entries = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const beingServed = entries.filter((e) => e.status === "in-service" || e.status === "called");
  const waiting     = entries.filter((e) => e.status === "waiting");

  const batch = writeBatch(firestore);

  // Only renumber WAITING customers
  waiting.forEach((entry, index) => {
    const newPosition       = index + 1;
    const avgDuration       = entry.services?.length
      ? entry.services.reduce((s, sv) => s + (sv.durationMin || 30), 0) / entry.services.length
      : 30;
    const effectiveStylists = Math.max(availableStylists - beingServed.length, 1);
    const newWait           = Math.round(((newPosition - 1) * avgDuration) / effectiveStylists);

    batch.update(doc(firestore, "salons", salonId, "queue", entry.id), {
      position:         newPosition,
      estimatedWaitMin: newWait,
      updatedAt:        serverTimestamp(),
    });
  });

  await batch.commit();

  // Update salon stats based on waiting customers only
  const totalWait  = waiting.reduce((s, e) => s + (e.estimatedWaitMin || 0), 0);
  const avgWaitMin = waiting.length > 0 ? Math.round(totalWait / waiting.length) : 0;

  await updateDoc(doc(firestore, "salons", salonId), {
    queueCount: waiting.length,
    avgWaitMin,
    updatedAt:  serverTimestamp(),
  });

  return { queueCount: waiting.length, avgWaitMin };
};