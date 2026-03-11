// apps/customer/src/screens/SalonDetailScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from "react-native";
import { getSalon } from "salonq-shared/firebase";
import { formatWait, isSalonOpen, formatPrice } from "salonq-shared/utils";
import { DAY_LABELS, DAYS } from "salonq-shared/models";

export default function SalonDetailScreen({ route, navigation }) {
  const { salonId } = route.params;
  const [salon,   setSalon]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("services"); // services | stylists | hours

  useEffect(() => {
    getSalon(salonId).then((s) => { setSalon(s); setLoading(false); });
  }, [salonId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  if (!salon) {
    return <View style={styles.center}><Text>Salon not found.</Text></View>;
  }

  const open = isSalonOpen(salon.hours);

  return (
    <SafeAreaView style={styles.container}>
      {/* Back */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>✂️</Text>
          <Text style={styles.salonName}>{salon.name}</Text>
          <Text style={styles.address}>{salon.address}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: open ? "#16a34a" : "#9ca3af" }]} />
            <Text style={{ color: open ? "#16a34a" : "#9ca3af", fontWeight: "600", fontSize: 14 }}>
              {open ? "Open now" : "Closed"}
            </Text>
            {open && salon.avgWaitMin !== undefined && (
              <Text style={styles.waitText}>  •  ⏱ {formatWait(salon.avgWaitMin)} wait</Text>
            )}
          </View>
        </View>

        {/* Check-in CTA */}
        {open && (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate("CheckIn", { salon })}
          >
            <Text style={styles.ctaText}>Join Queue →</Text>
            {salon.queueCount !== undefined && (
              <Text style={styles.ctaSub}>{salon.queueCount} people ahead</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {["services", "stylists", "hours"].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.section}>
          {tab === "services" && (
            <>
              {(salon.services || []).map((s) => (
                <View key={s.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.name}</Text>
                    <Text style={styles.rowSub}>{s.durationMin} min</Text>
                  </View>
                  <Text style={styles.price}>{formatPrice(s.price)}</Text>
                </View>
              ))}
              {(!salon.services || !salon.services.length) && (
                <Text style={styles.empty}>No services listed yet.</Text>
              )}
            </>
          )}

          {tab === "stylists" && (
            <>
              {(salon.stylists || []).map((st) => (
                <View key={st.id} style={styles.stylistRow}>
                  <View style={styles.stylistAvatar}>
                    <Text style={{ fontSize: 22 }}>💇</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{st.name}</Text>
                    <Text style={styles.rowSub}>{(st.skills || []).join(", ")}</Text>
                  </View>
                  <View style={[styles.stylistStatus, {
                    backgroundColor:
                      st.status === "available" ? "#dcfce7" :
                      st.status === "busy"      ? "#fee2e2" : "#fef9c3",
                  }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#374151" }}>
                      {st.status}
                    </Text>
                  </View>
                </View>
              ))}
              {(!salon.stylists || !salon.stylists.length) && (
                <Text style={styles.empty}>No stylists listed yet.</Text>
              )}
            </>
          )}

          {tab === "hours" && (
            <>
              {DAYS.map((d, i) => {
                const h = salon.hours?.[d];
                return (
                  <View key={d} style={styles.row}>
                    <Text style={[styles.rowTitle, { flex: 0.5 }]}>{DAY_LABELS[i]}</Text>
                    <Text style={styles.rowSub}>
                      {!h || h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  back:      { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  backText:  { fontSize: 15, color: "#1a1a2e", fontWeight: "600" },
  hero:      { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  salonName: { fontSize: 24, fontWeight: "800", color: "#1a1a2e", textAlign: "center" },
  address:   { fontSize: 13, color: "#6b7280", marginTop: 4, textAlign: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  waitText:  { fontSize: 13, color: "#6b7280" },
  cta: {
    margin: 16,
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  ctaSub:  { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tabBtn:       { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#1a1a2e" },
  tabText:      { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  tabTextActive:{ color: "#1a1a2e" },
  section: { padding: 16 },
  row:     { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  rowTitle:{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  rowSub:  { fontSize: 12, color: "#6b7280", marginTop: 2 },
  price:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  stylistAvatar:{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistStatus:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  empty:   { color: "#9ca3af", textAlign: "center", paddingTop: 24, fontSize: 14 },
});
