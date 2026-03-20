// apps/customer/src/utils/index.js

export const formatWait = (minutes) => {
  if (!minutes || minutes <= 0) return "Ready now";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

export const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

export const formatPrice = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(amount);

export const isSalonOpen = (hours, now = new Date()) => {
  if (!hours) return false;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const day = days[now.getDay()];
  const h = hours[day];

  if (!h || h.closed) {
    console.log(`Salon hours check — day: ${day}, hours not found or closed flag set`);
    return false;
  }

  const [openH, openM]   = h.open.split(":").map(Number);
  const [closeH, closeM] = h.close.split(":").map(Number);

  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const openMinutes  = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const isOpen       = nowMinutes >= openMinutes && nowMinutes < closeMinutes;

  console.log(
    `Salon hours check — day: ${day}, ` +
    `now: ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}, ` +
    `open: ${h.open}, close: ${h.close}, ` +
    `nowMinutes: ${nowMinutes}, openMinutes: ${openMinutes}, closeMinutes: ${closeMinutes}, ` +
    `isOpen: ${isOpen}`
  );

  return isOpen;
};

export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const calcEstimatedWait = (position, services = [], activeStylists = 1) => {
  if (position <= 0) return 0;
  const total = services.reduce((s, sv) => s + (sv.durationMin || 30), 0) || 30;
  return (position - 1) * Math.ceil(total / Math.max(activeStylists, 1));
};

export const STATUS_LABELS = {
  waiting:      "Waiting",
  called:       "You're being called! 🎉",
  "in-service": "In service",
  done:         "Done ✅",
  "no-show":    "Marked as no-show",
};

export const STATUS_COLORS = {
  waiting:      "#F59E0B",
  called:       "#10B981",
  "in-service": "#3B82F6",
  done:         "#6B7280",
  "no-show":    "#EF4444",
};

export const DAYS       = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];