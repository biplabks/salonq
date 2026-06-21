// apps/customer/src/screens/SalonDetailScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getSalon } from "../firebase";
import { formatWait, isSalonOpen, formatPrice, DAYS, DAY_LABELS } from "../utils";
import { useCurrentTime } from "../hooks/useCurrentTime";

const CARD_GRADIENTS = [
  ["#667eea", "#764ba2"],
  ["#f953c6", "#b91d73"],
  ["#4facfe", "#00f2fe"],
  ["#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140"],
  ["#30cfd0", "#667eea"],
  ["#a18cd1", "#fbc2eb"],
  ["#f7971e", "#ffd200"],
];

function getSalonGradient(id = "") {
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

function getSalonInitials(name = "") {
  return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "✂";
}

export default function SalonDetailScreen({ route, navigation }) {
  const now      = useCurrentTime();
  const { salonId } = route.params;
  const [salon,   setSalon]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("services");

  useEffect(() => {
    getSalon(salonId).then((s) => { setSalon(s); setLoading(false); });
  }, [salonId]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;
  if (!salon)  return <View style={s.center}><Text>Salon not found.</Text></View>;

  const open      = isSalonOpen(salon.hours, now);
  const gradient  = getSalonGradient(salonId);
  const initials  = getSalonInitials(salon.name);

  const stylists = (salon.stylists || []).map((st) => ({
    ...st, status: open ? st.status : "off",
  }));

  const stylistStatusConfig = {
    available: { label: "Available", bg: "#dcfce7", color: "#16a34a" },
    busy:      { label: "Busy",      bg: "#fee2e2", color: "#dc2626" },
    break:     { label: "On break",  bg: "#fef9c3", color: "#d97706" },
    off:       { label: "Off",       bg: "#f3f4f6", color: "#9ca3af" },
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Gradient Hero */}
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.heroInitials}>{initials}</Text>
          <Text style={s.salonName}>{salon.name}</Text>
          <Text style={s.address}>{salon.address}</Text>
          <View style={s.statusRow}>
            <View style={[s.openPill, { backgroundColor: open ? "#16a34a" : "rgba(255,255,255,0.2)" }]}>
              <View style={[s.openDot, { backgroundColor: open ? "#86efac" : "#d1d5db" }]} />
              <Text style={s.openPillText}>{open ? "Open now" : "Closed"}</Text>
            </View>
            {open && salon.avgWaitMin !== undefined && (
              <View style={s.waitPill}>
                <Text style={s.waitPillText}>⏱ {formatWait(salon.avgWaitMin)} wait</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Rating row */}
        {salon.avgRating ? (
          <TouchableOpacity
            style={s.ratingRow}
            onPress={() => navigation.navigate("Reviews", {
              salonId,
              salonName:    salon.name,
              avgRating:    salon.avgRating,
              totalRatings: salon.totalRatings,
            })}
          >
            <View style={s.ratingLeft}>
              <Text style={s.ratingStar}>★</Text>
              <Text style={s.ratingValue}>{salon.avgRating?.toFixed(1)}</Text>
              <Text style={s.ratingCount}>({salon.totalRatings} reviews)</Text>
            </View>
            <Text style={s.ratingArrow}>See all →</Text>
          </TouchableOpacity>
        ) : null}

        {/* Join Queue CTA */}
        {open ? (
          <TouchableOpacity style={s.cta} onPress={() => navigation.navigate("CheckIn", { salon })}>
            <Text style={s.ctaText}>Join Queue →</Text>
            {salon.queueCount !== undefined && (
              <Text style={s.ctaSub}>{salon.queueCount} people ahead</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={s.closedBanner}>
            <Text style={s.closedBannerText}>🕐 Salon is currently closed</Text>
            <Text style={s.closedBannerSub}>Check the hours below for opening times</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={s.tabs}>
          {["services", "stylists", "hours"].map((t) => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.section}>
          {/* Services */}
          {tab === "services" && (
            <>
              {(salon.services || []).map((sv) => (
                <View key={sv.id} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{sv.name}</Text>
                    <Text style={s.rowSub}>{sv.durationMin} min</Text>
                  </View>
                  <Text style={s.price}>{formatPrice(sv.price)}</Text>
                </View>
              ))}
              {!salon.services?.length && <Text style={s.empty}>No services listed.</Text>}
            </>
          )}

          {/* Stylists */}
          {tab === "stylists" && (
            <>
              {!open && (
                <View style={s.closedNote}>
                  <Text style={s.closedNoteText}>Salon is closed — all stylists are off duty</Text>
                </View>
              )}
              {stylists.map((st) => {
                const cfg = stylistStatusConfig[st.status] || stylistStatusConfig.off;
                return (
                  <View key={st.id} style={s.stylistRow}>
                    <View style={s.avatar}><Text style={{ fontSize: 22 }}>💇</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{st.name}</Text>
                      <Text style={s.rowSub}>{(st.skills || []).join(", ")}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })}
              {!stylists.length && <Text style={s.empty}>No stylists listed.</Text>}
            </>
          )}

          {/* Hours */}
          {tab === "hours" && DAYS.map((d, i) => {
            const h       = salon.hours?.[d];
            const isToday = ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()] === d;
            return (
              <View key={d} style={[s.row, isToday && s.todayRow]}>
                <Text style={[s.rowTitle, { flex: 0.5 }, isToday && { fontWeight: "800" }]}>
                  {DAY_LABELS[i]} {isToday ? "📍" : ""}
                </Text>
                <Text style={[s.rowSub, isToday && { color: "#1a1a2e", fontWeight: "600" }]}>
                  {!h || h.closed ? "Closed" : `${h.open} – ${h.close}`}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  hero:             { paddingTop: 16, paddingBottom: 28, paddingHorizontal: 20, alignItems: "center" },
  back:             { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  backText:         { fontSize: 14, color: "#fff", fontWeight: "700" },
  heroInitials:     { fontSize: 64, fontWeight: "900", color: "rgba(255,255,255,0.25)", letterSpacing: -3, marginBottom: 4 },
  salonName:        { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center" },
  address:          { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4, textAlign: "center", marginBottom: 14 },
  statusRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  openPill:         { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  openDot:          { width: 6, height: 6, borderRadius: 3 },
  openPillText:     { fontSize: 12, color: "#fff", fontWeight: "700" },
  waitPill:         { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  waitPillText:     { fontSize: 12, color: "#fff", fontWeight: "600" },
  ratingRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ratingLeft:       { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingStar:       { fontSize: 20, color: "#F59E0B" },
  ratingValue:      { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  ratingCount:      { fontSize: 13, color: "#6b7280" },
  ratingArrow:      { fontSize: 13, color: "#1a1a2e", fontWeight: "600" },
  cta:              { margin: 16, backgroundColor: "#1a1a2e", borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  ctaText:          { color: "#fff", fontSize: 17, fontWeight: "800" },
  ctaSub:           { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  closedBanner:     { margin: 16, backgroundColor: "#f3f4f6", borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  closedBannerText: { fontSize: 15, fontWeight: "700", color: "#6b7280" },
  closedBannerSub:  { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  tabs:             { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab:              { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive:        { borderBottomWidth: 2, borderBottomColor: "#1a1a2e" },
  tabText:          { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  tabTextActive:    { color: "#1a1a2e" },
  section:          { padding: 16 },
  row:              { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  todayRow:         { backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 8 },
  rowTitle:         { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  rowSub:           { fontSize: 12, color: "#6b7280", marginTop: 2 },
  price:            { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  avatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText:  { fontSize: 11, fontWeight: "600" },
  closedNote:       { backgroundColor: "#fef9c3", borderRadius: 10, padding: 12, marginBottom: 12 },
  closedNoteText:   { fontSize: 13, color: "#d97706", fontWeight: "600", textAlign: "center" },
  empty:            { color: "#9ca3af", textAlign: "center", paddingTop: 24, fontSize: 14 },
});
