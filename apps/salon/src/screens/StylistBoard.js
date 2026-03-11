// apps/salon/src/screens/StylistBoard.js
// Manage stylist availability, breaks, and current assignments.

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, Alert,
} from "react-native";
import { saveSalon } from "salonq-shared/firebase";

const STATUS_CONFIG = {
  available: { label: "Available", color: "#16a34a", bg: "#dcfce7" },
  busy:      { label: "With client", color: "#3B82F6", bg: "#dbeafe" },
  break:     { label: "On break",   color: "#d97706", bg: "#fef9c3" },
  off:       { label: "Off today",  color: "#9ca3af", bg: "#f3f4f6" },
};

export default function StylistBoard({ salon, salonId }) {
  const [stylists, setStylists] = useState(salon?.stylists || []);

  const updateStatus = async (stylistId, newStatus) => {
    const updated = stylists.map((s) =>
      s.id === stylistId ? { ...s, status: newStatus } : s
    );
    setStylists(updated);
    try {
      await saveSalon(salonId, { stylists: updated });
    } catch (err) {
      Alert.alert("Error saving", err.message);
    }
  };

  const available = stylists.filter((s) => s.status === "available").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stylist Board</Text>
        <View style={styles.availBadge}>
          <Text style={styles.availText}>{available} available</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {stylists.map((stylist) => {
          const cfg = STATUS_CONFIG[stylist.status] || STATUS_CONFIG.off;
          return (
            <View key={stylist.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: cfg.bg }]}>
                  <Text style={{ fontSize: 24 }}>💇</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stylistName}>{stylist.name}</Text>
                  <Text style={styles.skills}>{(stylist.skills || []).join(" · ")}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Quick status buttons */}
              <View style={styles.buttons}>
                {Object.entries(STATUS_CONFIG).map(([status, scfg]) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusBtn,
                      stylist.status === status && { backgroundColor: scfg.bg, borderColor: scfg.color },
                    ]}
                    onPress={() => updateStatus(stylist.id, status)}
                  >
                    <Text style={[
                      styles.statusBtnText,
                      stylist.status === status && { color: scfg.color, fontWeight: "700" },
                    ]}>
                      {scfg.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {!stylists.length && (
          <Text style={styles.empty}>No stylists added yet. Go to Settings to add your team.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:     { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  availBadge:{ backgroundColor: "#dcfce7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  availText: { color: "#16a34a", fontWeight: "700", fontSize: 13 },
  content:   { padding: 16, gap: 12 },
  card:      { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTop:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar:    { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stylistName:{ fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  skills:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusBadge:{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:{ fontSize: 12, fontWeight: "600" },
  buttons:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  statusBtnText: { fontSize: 12, color: "#6b7280" },
  empty:     { textAlign: "center", color: "#9ca3af", fontSize: 14, marginTop: 60 },
});
