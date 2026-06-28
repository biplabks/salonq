// apps/customer/src/screens/HomeScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import SalonMap from "../components/SalonMap";
import * as Location from "expo-location";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { formatWait, isSalonOpen, distanceKm } from "../utils";
import { useCurrentTime } from "../hooks/useCurrentTime";

const DEFAULT_REGION = {
  latitude:       23.7937,
  longitude:      90.4066,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};

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

export default function HomeScreen({ navigation }) {
  const now      = useCurrentTime();
  const [salons,      setSalons]      = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [viewMode,    setViewMode]    = useState("list");
  const [userLoc,     setUserLoc]     = useState(null);
  const [region,      setRegion]      = useState(DEFAULT_REGION);

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

  const renderSalon = ({ item }) => {
    const open      = isSalonOpen(item.hours, now);
    const distance  = getDistance(item);
    const count     = item.totalRatings ?? 0;
    const avg       = item.avgRating    ?? 0;
    const hasRating = count > 0;
    const fullStars = hasRating ? Math.round(avg) : 0;
    const gradient  = getSalonGradient(item.id);
    const initials  = getSalonInitials(item.name);

    return (
      <TouchableOpacity style={s.card} onPress={() => handleSalonPress(item)} activeOpacity={0.88}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
          <Text style={s.bannerInitials}>{initials}</Text>
          <View style={[s.openPill, { backgroundColor: open ? "#16a34a" : "rgba(0,0,0,0.35)" }]}>
            <View style={[s.openDot, { backgroundColor: open ? "#86efac" : "#d1d5db" }]} />
            <Text style={s.openPillText}>{open ? "Open" : "Closed"}</Text>
          </View>
        </LinearGradient>

        <View style={s.body}>
          <Text style={s.name}>{item.name}</Text>

          {hasRating ? (
            <View style={s.ratingRow}>
              <Text style={s.stars}>
                {[1, 2, 3, 4, 5].map((i) => (i <= fullStars ? "★" : "☆")).join("")}
              </Text>
              <Text style={s.ratingNum}>{avg.toFixed(1)}</Text>
              <Text style={s.ratingCount}>
                ({count} {count === 1 ? "review" : "reviews"})
              </Text>
            </View>
          ) : (
            <Text style={s.noRating}>No reviews yet</Text>
          )}

          <Text style={s.addr} numberOfLines={1}>{item.address}</Text>

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

  const renderMap = () => (
    <SalonMap filtered={filtered} region={region} onSalonPress={handleSalonPress} />
  );

  return (
    <SafeAreaView style={s.container}>
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
  container:     { flex: 1, backgroundColor: "#fafafa" },
  header:        { padding: 20, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:         { fontSize: 28, fontWeight: "800", color: "#1a1a2e", marginBottom: 10 },
  headerRow:     { flexDirection: "row", gap: 10, alignItems: "center" },
  search:        { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, fontSize: 15 },
  toggleBtn:     { backgroundColor: "#1a1a2e", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toggleBtnText: { fontSize: 20 },
  list:          { padding: 16, gap: 16 },
  card:          { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  banner:        { height: 130, alignItems: "center", justifyContent: "center" },
  bannerInitials:{ fontSize: 56, fontWeight: "900", color: "rgba(255,255,255,0.28)", letterSpacing: -3 },
  openPill:      { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  openDot:       { width: 6, height: 6, borderRadius: 3 },
  openPillText:  { fontSize: 11, color: "#fff", fontWeight: "700" },
  body:          { padding: 16 },
  name:          { fontSize: 17, fontWeight: "800", color: "#1a1a2e", marginBottom: 3 },
  ratingRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  stars:         { fontSize: 13, color: "#F59E0B", letterSpacing: 1 },
  ratingNum:     { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  ratingCount:   { fontSize: 12, color: "#9ca3af" },
  noRating:      { fontSize: 12, color: "#d1d5db", marginBottom: 4 },
  addr:          { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  badges:        { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge:         { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:     { fontSize: 12, color: "#374151", fontWeight: "500" },
  empty:         { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
});
