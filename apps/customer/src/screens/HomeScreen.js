// apps/customer/src/screens/HomeScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, SafeAreaView,
} from "react-native";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebase";
import { formatWait, isSalonOpen } from "../utils";

export default function HomeScreen({ navigation }) {
  const [salons,    setSalons]    = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);

  // Subscribe to salons in real-time so queueCount/avgWaitMin always stay fresh
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "salons")), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSalons(data);
      setFiltered(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      salons.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q)
      )
    );
  }, [search, salons]);

  const renderSalon = ({ item }) => {
    const open = isSalonOpen(item.hours);
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate("SalonDetail", { salonId: item.id })}
        activeOpacity={0.85}
      >
        <View style={[s.banner, { backgroundColor: open ? "#dcfce7" : "#f3f4f6" }]}>
          <Text style={{ fontSize: 40 }}>✂️</Text>
          <View style={[s.dot, { backgroundColor: open ? "#16a34a" : "#9ca3af" }]} />
        </View>
        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={{ color: open ? "#16a34a" : "#9ca3af", fontWeight: "600", fontSize: 12 }}>
              {open ? "Open" : "Closed"}
            </Text>
          </View>
          <Text style={s.addr}>{item.address}</Text>
          <View style={s.badges}>
            {open && item.queueCount !== undefined && (
              <View style={s.badge}>
                <Text style={s.badgeText}>👥 {item.queueCount} waiting</Text>
              </View>
            )}
            {open && item.avgWaitMin !== undefined && (
              <View style={[s.badge, { backgroundColor: "#fef9c3" }]}>
                <Text style={s.badgeText}>⏱ {formatWait(item.avgWaitMin)}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Find a Salon</Text>
        <TextInput
          style={s.search}
          placeholder="Search salons…"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1a1a2e" size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderSalon}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No salons found.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header:    { padding: 20, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:     { fontSize: 28, fontWeight: "800", color: "#1a1a2e", marginBottom: 10 },
  search:    { backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, fontSize: 15 },
  list:      { padding: 16, gap: 14 },
  card:      { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  banner:    { height: 80, alignItems: "center", justifyContent: "center" },
  dot:       { position: "absolute", top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },
  body:      { padding: 16 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name:      { fontSize: 17, fontWeight: "700", color: "#1a1a2e", flex: 1 },
  addr:      { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  badges:    { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge:     { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  empty:     { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
});