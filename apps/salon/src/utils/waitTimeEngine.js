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
  try {
    const queueRef = collection(firestore, "salons", salonId, "queue");

    // Fetch all active entries (no orderBy to avoid composite index requirement)
    const snap = await getDocs(
      query(queueRef, where("status", "in", ["waiting", "called", "in-service"]))
    );

    const entries = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const beingServed = entries.filter((e) => e.status === "in-service" || e.status === "called");
    const waiting     = entries.filter((e) => e.status === "waiting");

    // Batch update all waiting customers with new position + wait time
    const batch = writeBatch(firestore);

    waiting.forEach((entry, index) => {
      const newPosition  = index + 1;
      const avgDuration  = entry.services?.length
        ? entry.services.reduce((s, sv) => s + (sv.durationMin || 30), 0) / entry.services.length
        : 30;
      const effectiveStylists = Math.max(availableStylists - beingServed.length, 1);
      const newWait      = Math.round(((newPosition - 1) * avgDuration) / effectiveStylists);

      batch.update(doc(firestore, "salons", salonId, "queue", entry.id), {
        position:         newPosition,
        estimatedWaitMin: newWait,
        updatedAt:        serverTimestamp(),
      });
    });

    await batch.commit();

    // Calculate stats for salon document
    const totalWait  = waiting.reduce((s, e) => s + (e.estimatedWaitMin || 0), 0);
    const avgWaitMin = waiting.length > 0 ? Math.round(totalWait / waiting.length) : 0;
    const queueCount = waiting.length;

    // Update salon document with live stats
    await updateDoc(doc(firestore, "salons", salonId), {
      queueCount,
      avgWaitMin,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Queue recalculated — ${queueCount} waiting, avg wait: ${avgWaitMin} min`);
    return { queueCount, avgWaitMin };

  } catch (err) {
    console.error("recalculateQueue error:", err);
  }
};