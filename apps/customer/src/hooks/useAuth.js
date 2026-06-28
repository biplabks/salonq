// apps/customer/src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { onAuthChange, saveCustomer } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        saveCustomer(u.uid, {
          displayName: u.displayName,
          email:       u.email,
          photoURL:    u.photoURL,
        }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  return { user, loading };
}
