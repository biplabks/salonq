// apps/customer/src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { onAuthChange } from "salonq-shared/firebase";

export function useAuth() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
