// apps/customer/src/screens/HomeScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, SafeAreaView,
} from "react-native";
import SalonMap from "../components/SalonMap";
import * as Location from "expo-location";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { formatWait, isSalonOpen, distanceKm } from "../utils";
import { useCurrentTime } from "../hooks/useCurrentTime";

// Default center — Dhaka, Bangladesh
const DEFAULT_REGION = {
  latitude:       23.7937,
  longitude:      90.4066,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};

export default function HomeScreen({ navigation }) {
  const now      = useCurrentTime();
  const [salons,   setSalons]   = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const [userLoc,  setUserLoc]  = useState(null);
  const [region,   setRegion]   = useState(DEFAULT_REGION);

  // Get user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc(loc.coords);
        setRegion({
          latitude:       loc.coords.latitude,
          longitude:      loc.coords.longitude,
          latitudeDelta:  0.05,
          longitudeDelta: 0.05,
        });
      }
    })();
  }, []);

  // Subscribe to salons in real-time
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "salons")), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSalons(data);
      setFiltered(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Filter by search
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      salons.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q)
      )
    );
  }, [search, salons]);

  const getDistance = (salon) => {
    if (!userLoc || !salon.location) return null;
    const km = distanceKm(
      userLoc.latitude, userLoc.longitude,
      salon.location.lat, salon.location.lng
    );
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  };

  const handleSalonPress = (salon) => {
    navigation.navigate("SalonDetail", { salonId: salon.id });
  };

// ── List item ──────────────────────────────────────────────────────────────
  const renderSalon = ({ item }) => {
    const open     = isSalonOpen(item.hours, now);
    const distance = getDistance(item);
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => handleSalonPress(item)}
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
            {distance && (
              <View style={s.badge}>
                <Text style={s.badgeText}>📍 {distance}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Map view ───────────────────────────────────────────────────────────────
  const renderMap = () => (
    <SalonMap
      filtered={filtered}
      region={region}
      onSalonPress={handleSalonPress}
    />
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Find a Salon</Text>
        <View style={s.headerRow}>
          <TextInput
            style={s.search}
            placeholder="Search salons…"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            style={s.toggleBtn}
            onPress={() => setViewMode(viewMode === "list" ? "map" : "list")}
          >
            <Text style={s.toggleBtnText}>{viewMode === "list" ? "🗺️" : "☰"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1a1a2e" size="large" />
      ) : viewMode === "list" ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderSalon}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No salons found.</Text>}
        />
      ) : (
        renderMap()
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  header:           { padding: 20, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:            { fontSize: 28, fontWeight: "800", color: "#1a1a2e", marginBottom: 10 },
  headerRow:        { flexDirection: "row", gap: 10, alignItems: "center" },
  search:           { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, fontSize: 15 },
  toggleBtn:        { backgroundColor: "#1a1a2e", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toggleBtnText:    { fontSize: 20 },
  list:             { padding: 16, gap: 14 },
  card:             { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  banner:           { height: 80, alignItems: "center", justifyContent: "center" },
  dot:              { position: "absolute", top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },
  body:             { padding: 16 },
  row:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name:             { fontSize: 17, fontWeight: "700", color: "#1a1a2e", flex: 1 },
  addr:             { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  badges:           { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge:            { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:        { fontSize: 12, color: "#374151", fontWeight: "500" },
  empty:            { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
});
