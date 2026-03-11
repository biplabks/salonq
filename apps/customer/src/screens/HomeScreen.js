// apps/customer/src/screens/HomeScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  RefreshControl, SafeAreaView,
} from "react-native";
import * as Location from "expo-location";
import { getSalons } from "salonq-shared/firebase";
import { formatWait, isSalonOpen, distanceKm } from "salonq-shared/utils";

export default function HomeScreen({ navigation }) {
  const [salons,    setSalons]    = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLoc,   setUserLoc]   = useState(null);

  useEffect(() => {
    fetchLocation();
    fetchSalons();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      salons.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      )
    );
  }, [search, salons]);

  const fetchLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setUserLoc(loc.coords);
    }
  };

  const fetchSalons = async () => {
    setLoading(true);
    try {
      const data = await getSalons();
      setSalons(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDistance = (salon) => {
    if (!userLoc || !salon.location) return null;
    const km = distanceKm(
      userLoc.latitude, userLoc.longitude,
      salon.location.lat, salon.location.lng
    );
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  };

  const renderSalon = ({ item }) => {
    const open     = isSalonOpen(item.hours);
    const distance = getDistance(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("SalonDetail", { salonId: item.id })}
        activeOpacity={0.85}
      >
        {/* Colour banner */}
        <View style={[styles.banner, { backgroundColor: open ? "#dcfce7" : "#f3f4f6" }]}>
          <Text style={styles.bannerEmoji}>✂️</Text>
          <View style={[styles.statusDot, { backgroundColor: open ? "#16a34a" : "#9ca3af" }]} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.salonName}>{item.name}</Text>
            <Text style={[styles.statusText, { color: open ? "#16a34a" : "#9ca3af" }]}>
              {open ? "Open" : "Closed"}
            </Text>
          </View>

          <Text style={styles.address}>{item.address}</Text>

          <View style={styles.metaRow}>
            {open && item.queueCount !== undefined && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>👥 {item.queueCount} waiting</Text>
              </View>
            )}
            {open && item.avgWaitMin !== undefined && (
              <View style={[styles.metaBadge, styles.metaBadgeGold]}>
                <Text style={styles.metaText}>⏱ {formatWait(item.avgWaitMin)}</Text>
              </View>
            )}
            {distance && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>📍 {distance}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Find a salon</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by name or area…"
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
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSalons(); }} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No salons found. Try a different search.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  greeting:  { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginBottom: 10 },
  search:    { backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, fontSize: 15, color: "#1a1a2e" },
  list:      { padding: 16, gap: 14 },
  card:      { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  banner:    { height: 80, alignItems: "center", justifyContent: "center" },
  bannerEmoji: { fontSize: 36 },
  statusDot: { position: "absolute", top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },
  cardBody:  { padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  salonName: { fontSize: 17, fontWeight: "700", color: "#1a1a2e", flex: 1 },
  statusText:{ fontSize: 12, fontWeight: "600" },
  address:   { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  metaRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaBadge: { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  metaBadgeGold: { backgroundColor: "#fef9c3" },
  metaText:  { fontSize: 12, color: "#374151", fontWeight: "500" },
  empty:     { textAlign: "center", marginTop: 60, color: "#9ca3af", fontSize: 15 },
});
