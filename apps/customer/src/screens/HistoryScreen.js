// apps/customer/src/screens/HistoryScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { getAuth } from "firebase/auth";
import { getVisitHistory, getSalon } from "../firebase";
import { formatDate, formatPrice } from "../utils";

export default function HistoryScreen({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getVisitHistory(user.uid).then(async (vs) => {
      const enriched = await Promise.all(vs.map(async (v) => {
        const salon = await getSalon(v.salonId);
        return { ...v, salonName: salon?.name || "Salon" };
      }));
      setVisits(enriched);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Visit History</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 60 }} color="#1a1a2e" size="large" /> : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.salonName}>{item.salonName}</Text>
                <Text style={s.date}>{formatDate(item.completedAt)}</Text>
              </View>
              <Text style={s.services}>{(item.services || []).map((sv) => sv.name).join(", ")}</Text>
              <View style={s.cardFooter}>
                <Text style={s.total}>{formatPrice(item.totalPrice)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
              <Text style={s.emptyText}>No visits yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fafafa" },
  back:       { paddingHorizontal: 20, paddingTop: 12 },
  backText:   { fontSize: 15, color: "#1a1a2e", fontWeight: "600" },
  title:      { fontSize: 26, fontWeight: "800", color: "#1a1a2e", paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  list:       { padding: 20, gap: 12 },
  card:       { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  salonName:  { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  date:       { fontSize: 12, color: "#9ca3af" },
  services:   { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  total:      { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  empty:      { alignItems: "center", marginTop: 80 },
  emptyText:  { fontSize: 15, color: "#6b7280" },
});
