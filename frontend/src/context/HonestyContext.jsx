// src/context/HonestyContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getHonestyScore } from "../services/apiService";

const HonestyContext = createContext(null);

export const useHonesty = () => useContext(HonestyContext);

export function HonestyProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [honesty, setHonesty] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHonesty(null);
      setLoading(false);
      return;
    }
    try {
      const res = await getHonestyScore();
      setHonesty(res?.honesty || null);
    } catch {
      // Non-fatal — keep whatever we had (or null on first load)
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  // Gentle polling so the navbar warning stays fresh without being noisy.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  return (
    <HonestyContext.Provider value={{ honesty, loading, refresh }}>
      {children}
    </HonestyContext.Provider>
  );
}

export default HonestyContext;
