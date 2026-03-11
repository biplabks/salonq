// apps/customer/src/hooks/useQueue.js
import { useState, useEffect } from "react";
import { subscribeToQueueEntry, subscribeToQueue } from "salonq-shared/firebase";

/** Subscribe to the customer's own queue entry */
export function useQueueEntry(salonId, entryId) {
  const [entry, setEntry]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId || !entryId) return;
    setLoading(true);
    const unsub = subscribeToQueueEntry(salonId, entryId, (e) => {
      setEntry(e);
      setLoading(false);
    });
    return unsub;
  }, [salonId, entryId]);

  return { entry, loading };
}

/** Subscribe to an entire salon queue (for salon dashboard) */
export function useSalonQueue(salonId) {
  const [queue, setQueue]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    const unsub = subscribeToQueue(salonId, (entries) => {
      setQueue(entries);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  return { queue, loading };
}
