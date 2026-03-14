// apps/salon/src/screens/StylistBoard.js
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from "react-native";
import { saveSalon } from "../firebase";

const STATUS_CONFIG = {
  available: { label: "Available",    color: "#16a34a", bg: "#dcfce7" },
  busy:      { label: "With client",  color: "#3B82F6", bg: "#dbeafe" },
  break:     { label: "On break",     color: "#d97706", bg: "#fef9c3" },
  off:       { label: "Off today",    color: "#9ca3af", bg: "#f3f4f6" },
};

export default function StylistBoard({ salon, salonId }) {
  const [stylists, setStylists] = useState(salon?.stylists || []);

  const updateStatus = async (id, status) => {
    const updated = stylists.map((s) => s.id === id ? { ...s, status } : s);
    setStylists(updated);
    try { await saveSalon(salonId, { stylists: updated }); }
    catch (err) { Alert.alert("Error", err.message); }
  };

  const available = stylists.filter((s) => s.status === "available").length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Stylist Board</Text>
        <View style={s.badge}><Text style={s.badgeText}>{available} available</Text></View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {stylists.map((st) => {
          const cfg = STATUS_CONFIG[st.status] || STATUS_CONFIG.off;
          return (
            <View key={st.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: cfg.bg }]}><Text style={{ fontSize: 24 }}>💇</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{st.name}</Text>
                  <Text style={s.skills}>{(st.skills || []).join(" · ")}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <View style={s.buttons}>
                {Object.entries(STATUS_CONFIG).map(([status, scfg]) => (
                  <TouchableOpacity
                    key={status}
                    style={[s.statusBtn, st.status === status && { backgroundColor: scfg.bg, borderColor: scfg.color }]}
                    onPress={() => updateStatus(st.id, status)}
                  >
                    <Text style={[s.statusBtnText, st.status === status && { color: scfg.color, fontWeight: "700" }]}>
                      {scfg.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
        {!stylists.length && <Text style={s.empty}>No stylists added yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fafafa" },
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:      { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  badge:      { backgroundColor: "#dcfce7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText:  { color: "#16a34a", fontWeight: "700", fontSize: 13 },
  content:    { padding: 16, gap: 12 },
  card:       { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTop:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar:     { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name:       { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  skills:     { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusBadge:{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  buttons:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn:  { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  statusBtnText: { fontSize: 12, color: "#6b7280" },
  empty:      { textAlign: "center", color: "#9ca3af", fontSize: 14, marginTop: 60 },
});
