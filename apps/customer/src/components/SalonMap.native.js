// apps/customer/src/components/SalonMap.native.js
// Only bundled on iOS/Android — react-native-maps is not web-compatible
import React, { useRef } from "react";
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
// Lazy require avoids module-level Platform access on RN 0.76 New Architecture
// (react-native-maps accesses Platform.OS at evaluation time, which races with
//  TurboModule registration and causes 'PlatformConstants could not be found')
import { isSalonOpen, formatWait } from "../utils";

const { width, height } = Dimensions.get("window");

export default function SalonMap({ filtered, region, onSalonPress }) {
  // Deferred require — runs when component mounts, after native runtime is ready
  const RNMaps = require("react-native-maps");
  const MapView = RNMaps.default;
  const { Marker, Callout } = RNMaps;

  const mapRef = useRef(null);

  const focusMapOnSalon = (salon) => {
    if (!salon.location || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       salon.location.lat,
      longitude:      salon.location.lng,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={s.map}
        region={region}
        showsUserLocation
        showsMyLocationButton
      >
        {filtered.map((salon) => {
          if (!salon.location?.lat || !salon.location?.lng) return null;
          const open = isSalonOpen(salon.hours);
          return (
            <Marker
              key={salon.id}
              coordinate={{ latitude: salon.location.lat, longitude: salon.location.lng }}
              pinColor={open ? "#16a34a" : "#9ca3af"}
            >
              <Callout onPress={() => onSalonPress(salon)} tooltip>
                <View style={s.callout}>
                  <Text style={s.calloutName}>{salon.name}</Text>
                  <Text style={s.calloutAddr} numberOfLines={1}>{salon.address}</Text>
                  <View style={s.calloutBadges}>
                    <View style={[s.calloutBadge, { backgroundColor: open ? "#dcfce7" : "#f3f4f6" }]}>
                      <Text style={[s.calloutBadgeText, { color: open ? "#16a34a" : "#9ca3af" }]}>
                        {open ? "Open" : "Closed"}
                      </Text>
                    </View>
                    {open && salon.queueCount !== undefined && (
                      <View style={s.calloutBadge}>
                        <Text style={s.calloutBadgeText}>👥 {salon.queueCount}</Text>
                      </View>
                    )}
                    {open && salon.avgWaitMin !== undefined && (
                      <View style={[s.calloutBadge, { backgroundColor: "#fef9c3" }]}>
                        <Text style={s.calloutBadgeText}>⏱ {formatWait(salon.avgWaitMin)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.calloutTap}>Tap to view →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={s.mapBottomList}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          renderItem={({ item }) => {
            const open = isSalonOpen(item.hours);
            return (
              <TouchableOpacity
                style={s.mapCard}
                onPress={() => { focusMapOnSalon(item); onSalonPress(item); }}
              >
                <Text style={s.mapCardName}>{item.name}</Text>
                <Text style={s.mapCardAddr} numberOfLines={1}>{item.address}</Text>
                <View style={s.mapCardBadges}>
                  <View style={[s.mapCardDot, { backgroundColor: open ? "#16a34a" : "#9ca3af" }]} />
                  <Text style={s.mapCardStatus}>{open ? "Open" : "Closed"}</Text>
                  {open && item.avgWaitMin !== undefined && (
                    <Text style={s.mapCardWait}>⏱ {formatWait(item.avgWaitMin)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  map:              { width, height: height * 0.65 },
  callout:          { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 220 },
  calloutName:      { fontSize: 15, fontWeight: "800", color: "#1a1a2e", marginBottom: 2 },
  calloutAddr:      { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  calloutBadges:    { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  calloutBadge:     { backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  calloutBadgeText: { fontSize: 11, color: "#374151", fontWeight: "500" },
  calloutTap:       { fontSize: 12, color: "#1a1a2e", fontWeight: "700", textAlign: "right" },
  mapBottomList:    { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 12 },
  mapCard:          { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 180, elevation: 4 },
  mapCardName:      { fontSize: 14, fontWeight: "700", color: "#1a1a2e", marginBottom: 2 },
  mapCardAddr:      { fontSize: 11, color: "#6b7280", marginBottom: 6 },
  mapCardBadges:    { flexDirection: "row", alignItems: "center", gap: 6 },
  mapCardDot:       { width: 7, height: 7, borderRadius: 4 },
  mapCardStatus:    { fontSize: 11, color: "#6b7280", fontWeight: "500" },
  mapCardWait:      { fontSize: 11, color: "#d97706", fontWeight: "600" },
});
