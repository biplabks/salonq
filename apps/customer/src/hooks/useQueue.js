// apps/customer/src/hooks/useQueue.js
import { useState, useEffect } from "react";
import { subscribeToQueueEntry, subscribeToQueue } from "../firebase";

export function useQueueEntry(salonId, entryId) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId || !entryId) { setLoading(false); return; }
    const unsub = subscribeToQueueEntry(salonId, entryId, (e) => {
      setEntry(e);
      setLoading(false);
    });
    return unsub;
  }, [salonId, entryId]);

  return { entry, loading };
}

export function useSalonQueue(salonId) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeToQueue(salonId, (entries) => {
      setQueue(entries);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  return { queue, loading };
}
