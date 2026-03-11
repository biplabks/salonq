// packages/shared/utils/index.js

/**
 * Format minutes into a human-friendly wait time string.
 * e.g. 75 → "1 hr 15 min"
 */
export const formatWait = (minutes) => {
  if (!minutes || minutes <= 0) return "Ready now";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

/**
 * Format a Firestore Timestamp or Date to a readable time string.
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Format a Firestore Timestamp or Date to a readable date string.
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

/**
 * Calculate estimated wait for a given position in queue.
 */
export const calcEstimatedWait = (position, services = [], activeStylists = 1) => {
  if (position <= 0) return 0;
  const totalDuration = services.reduce((sum, s) => sum + (s.durationMin || 30), 0) || 30;
  const waitPerPosition = Math.ceil(totalDuration / Math.max(activeStylists, 1));
  return (position - 1) * waitPerPosition;
};

/**
 * Determine if a salon is currently open based on its hours object.
 */
export const isSalonOpen = (hours) => {
  if (!hours) return false;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now  = new Date();
  const day  = days[now.getDay()];
  const todayHours = hours[day];
  if (!todayHours || todayHours.closed) return false;

  const [openH, openM]   = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const openMin  = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  return nowMin >= openMin && nowMin < closeMin;
};

/**
 * Calculate straight-line distance between two lat/lng points (km).
 * Uses the Haversine formula.
 */
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Currency formatter.
 */
export const formatPrice = (amount, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

/**
 * Generate a short display name from a full name.
 * e.g. "Maria Santos" → "M. Santos"
 */
export const shortName = (fullName = "") => {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
};
