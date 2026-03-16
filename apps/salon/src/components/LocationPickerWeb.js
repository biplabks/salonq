// apps/salon/src/components/LocationPickerWeb.js
// Google Maps-based location pin picker for web
import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
const DEFAULT_CENTER = { lat: 23.7937, lng: 90.4066 };

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(); return; }
    if (document.getElementById("google-maps-script")) {
      const interval = setInterval(() => {
        if (window.google && window.google.maps) { clearInterval(interval); resolve(); }
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

/**
 * Props:
 *   value       – { lat, lng } or null
 *   onChange    – called with { lat, lng } when user picks a location
 *   darkMode    – true = dark input style (for SalonRegisterScreen)
 */
export default function LocationPickerWeb({ value, onChange, darkMode = false }) {
  const mapDivRef  = useRef(null);
  const mapRef     = useRef(null);
  const markerRef  = useRef(null);
  const [mapReady,         setMapReady]         = useState(false);
  const [coords,           setCoords]           = useState(
    value?.lat && value?.lng ? value : null
  );
  const [gettingLocation, setGettingLocation]   = useState(false);

  useEffect(() => {
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY).then(() => {
      if (!mapDivRef.current || mapRef.current) return;
      const center = coords || DEFAULT_CENTER;
      mapRef.current = new window.google.maps.Map(mapDivRef.current, {
        center,
        zoom: coords ? 15 : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      // If value already set, show existing pin
      if (coords) placeMarker(coords, false);

      // Click anywhere to place / move pin
      mapRef.current.addListener("click", (e) => {
        placeMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() }, true);
      });
      setMapReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function placeMarker({ lat, lng }, pan = true) {
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
    });
    markerRef.current.addListener("dragend", (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setCoords({ lat: newLat, lng: newLng });
      onChange?.({ lat: newLat, lng: newLng });
    });
    if (pan) mapRef.current.panTo({ lat, lng });
    setCoords({ lat, lng });
    onChange?.({ lat, lng });
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current) {
          mapRef.current.setZoom(16);
          placeMarker({ lat, lng }, true);
        }
        setGettingLocation(false);
      },
      () => setGettingLocation(false)
    );
  };

  return (
    <View>
      <View style={s.topRow}>
        <TouchableOpacity
          style={[s.locBtn, darkMode && s.locBtnDark]}
          onPress={handleUseMyLocation}
          disabled={gettingLocation}
        >
          {gettingLocation
            ? <ActivityIndicator size="small" color={darkMode ? "#fff" : "#1a1a2e"} />
            : <Text style={[s.locBtnText, darkMode && s.locBtnTextDark]}>📍 Use my location</Text>
          }
        </TouchableOpacity>
        {coords && (
          <Text style={[s.coordsText, darkMode && s.coordsTextDark]}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
      </View>

      <div
        ref={mapDivRef}
        style={{ width: "100%", height: 240, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}
      />

      {!mapReady && (
        <View style={s.loading}>
          <ActivityIndicator color="#1a1a2e" />
        </View>
      )}

      <Text style={[s.hint, darkMode && s.hintDark]}>
        Tap the map to pin your salon location. Drag the marker to adjust.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  topRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  locBtn:          { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  locBtnDark:      { backgroundColor: "#ffffff20", borderWidth: 1, borderColor: "#ffffff30" },
  locBtnText:      { color: "#1a1a2e", fontSize: 13, fontWeight: "600" },
  locBtnTextDark:  { color: "#fff" },
  coordsText:      { fontSize: 11, color: "#6b7280" },
  coordsTextDark:  { fontSize: 11, color: "#9ca3af" },
  loading:         { alignItems: "center", marginTop: 8 },
  hint:            { fontSize: 11, color: "#9ca3af", marginTop: 6, textAlign: "center" },
  hintDark:        { color: "#6b7280" },
});
