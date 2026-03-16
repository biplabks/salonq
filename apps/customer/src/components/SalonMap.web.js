// apps/customer/src/components/SalonMap.web.js
// Google Maps JavaScript API implementation for web
import { useEffect, useRef, useState } from "react";
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from "react-native";
import { isSalonOpen, formatWait } from "../utils";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    if (document.getElementById("google-maps-script")) {
      // Script already injected — wait for it
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function SalonMap({ filtered, region, onSalonPress }) {
  const mapDivRef  = useRef(null);
  const mapRef     = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialise map once
  useEffect(() => {
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY).then(() => {
      if (!mapDivRef.current || mapRef.current) return;
      mapRef.current = new window.google.maps.Map(mapDivRef.current, {
        center: { lat: region?.latitude ?? 23.7937, lng: region?.longitude ?? 90.4066 },
        zoom: 13,
        disableDefaultUI: false,
        mapTypeControl: false,
      });
      setMapReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-draw markers whenever map becomes ready or salons change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    redrawMarkers();
  }, [filtered, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function redrawMarkers() {
    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (!mapRef.current || !window.google) return;

    filtered.forEach((salon) => {
      if (!salon.location?.lat || !salon.location?.lng) return;
      const open = isSalonOpen(salon.hours);

      const marker = new window.google.maps.Marker({
        position: { lat: salon.location.lat, lng: salon.location.lng },
        map: mapRef.current,
        title: salon.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor:   open ? "#16a34a" : "#9ca3af",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });

      const waitLine = open && salon.avgWaitMin !== undefined
        ? `<span style="color:#d97706;font-weight:600">⏱ ${formatWait(salon.avgWaitMin)}</span>`
        : "";
      const queueLine = open && salon.queueCount !== undefined
        ? `<span style="color:#374151">👥 ${salon.queueCount} waiting</span>`
        : "";
      const statusColor = open ? "#16a34a" : "#9ca3af";

      const content = `
        <div style="
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          padding:12px 14px;min-width:200px;max-width:240px;
          border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.12);background:#fff;
        ">
          <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:2px">
            ${salon.name}
          </div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:8px">
            ${salon.address || ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            <span style="
              background:${open ? "#dcfce7" : "#f3f4f6"};
              color:${statusColor};font-size:11px;font-weight:600;
              padding:3px 8px;border-radius:6px;
            ">${open ? "Open" : "Closed"}</span>
            ${queueLine ? `<span style="background:#f3f4f6;font-size:11px;padding:3px 8px;border-radius:6px">${queueLine}</span>` : ""}
            ${waitLine  ? `<span style="background:#fef9c3;font-size:11px;padding:3px 8px;border-radius:6px">${waitLine}</span>`  : ""}
          </div>
          <button
            onclick="window._salonQPress('${salon.id}')"
            style="
              width:100%;background:#1a1a2e;color:#fff;border:none;
              border-radius:8px;padding:8px 0;font-size:13px;font-weight:700;
              cursor:pointer;
            "
          >View Salon →</button>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({ content });

      marker.addListener("click", () => {
        infoWindow.open({ anchor: marker, map: mapRef.current });
      });

      markersRef.current.push(marker);
    });
  }

  // Global callback for InfoWindow button
  useEffect(() => {
    window._salonQPress = (salonId) => {
      const salon = filtered.find((s) => s.id === salonId);
      if (salon && onSalonPress) onSalonPress(salon);
    };
    return () => { delete window._salonQPress; };
  }, [filtered, onSalonPress]);

  return (
    <View style={s.wrapper}>
      {/* Google Map canvas */}
      <div ref={mapDivRef} style={{ flex: 1, width: "100%", minHeight: 400 }} />

      {/* Horizontal salon list below map */}
      <View style={s.listRow}>
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
                style={s.card}
                onPress={() => onSalonPress && onSalonPress(item)}
              >
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardAddr} numberOfLines={1}>{item.address}</Text>
                <View style={s.cardBadges}>
                  <View style={[s.dot, { backgroundColor: open ? "#16a34a" : "#9ca3af" }]} />
                  <Text style={s.cardStatus}>{open ? "Open" : "Closed"}</Text>
                  {open && item.avgWaitMin !== undefined && (
                    <Text style={s.cardWait}>⏱ {formatWait(item.avgWaitMin)}</Text>
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
  wrapper:    { flex: 1, display: "flex", flexDirection: "column" },
  listRow:    { paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.95)" },
  card:       { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 180, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  cardName:   { fontSize: 14, fontWeight: "700", color: "#1a1a2e", marginBottom: 2 },
  cardAddr:   { fontSize: 11, color: "#6b7280", marginBottom: 6 },
  cardBadges: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  cardStatus: { fontSize: 11, color: "#6b7280", fontWeight: "500" },
  cardWait:   { fontSize: 11, color: "#d97706", fontWeight: "600" },
});
