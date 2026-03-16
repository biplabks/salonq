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
    const effectiveStylists = Math.max(availableStylists - beingServed.length, 1);

    waiting.forEach((entry, index) => {
      const newPosition = index + 1;
      const avgDuration = entry.services?.length
        ? entry.services.reduce((s, sv) => s + (sv.durationMin || 30), 0) / entry.services.length
        : 30;
      const newWait = Math.round(((newPosition - 1) * avgDuration) / effectiveStylists);

      batch.update(doc(firestore, "salons", salonId, "queue", entry.id), {
        position:         newPosition,
        estimatedWaitMin: newWait,
        updatedAt:        serverTimestamp(),
      });
    });

    await batch.commit();

    // avgWaitMin = how long a NEW customer joining now would wait
    const queueCount  = waiting.length;
    const freeStylists = Math.max(availableStylists - beingServed.length, 0);

    let avgWaitMin;
    if (queueCount === 0 && freeStylists > 0) {
      // Queue empty and at least one stylist free → serve immediately
      avgWaitMin = 0;
    } else if (queueCount === 0 && freeStylists === 0) {
      // Queue empty but all stylists busy → wait for current service to finish
      avgWaitMin = Math.round(30 / Math.max(availableStylists, 1));
    } else {
      // People already waiting
      const avgDurationEstimate =
        waiting.reduce((s, e) => s + (e.services?.reduce((a, sv) => a + (sv.durationMin || 30), 0) || 30), 0) / waiting.length;
      avgWaitMin = Math.round((queueCount * avgDurationEstimate) / effectiveStylists);
    }

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