// apps/salon/src/screens/SalonSettingsScreen.js
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { logout } from "../firebase";
import ManageStylistsScreen  from "./ManageStylistsScreen";
import ManageServicesScreen  from "./ManageServicesScreen";
import ManageHoursScreen     from "./ManageHoursScreen";

export default function SalonSettingsScreen({ salon, salonId }) {
  const [screen, setScreen] = useState("main"); // "main" | "stylists" | "services" | "hours"
  const user = getAuth().currentUser;

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try { await logout(); }
            catch (err) { Alert.alert("Error", err.message); }
          },
        },
      ]
    );
  };

  // Sub-screens
  if (screen === "stylists") {
    return <ManageStylistsScreen salon={salon} salonId={salonId} onBack={() => setScreen("main")} />;
  }
  if (screen === "services") {
    return <ManageServicesScreen salon={salon} salonId={salonId} onBack={() => setScreen("main")} />;
  }
  if (screen === "hours") {
    return <ManageHoursScreen salon={salon} salonId={salonId} onBack={() => setScreen("main")} />;
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Settings</Text>

      {/* Salon info card */}
      <View style={s.card}>
        <View style={s.salonIcon}>
          <Text style={{ fontSize: 28 }}>✂️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.salonName}>{salon?.name || "Your Salon"}</Text>
          <Text style={s.salonAddr}>{salon?.address || ""}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={s.infoCard}>
        <Row label="Logged in as" value={user?.email || "—"} />
        <Row label="Salon ID"     value={salonId || "—"} />
        <Row label="Role"         value="Owner" last />
      </View>

      {/* Menu */}
      <View style={s.menu}>
        <MenuItem
          emoji="💇"
          label="Manage stylists"
          onPress={() => setScreen("stylists")}
        />
        <MenuItem
          emoji="💈"
          label="Services & pricing"
          onPress={() => setScreen("services")}
        />
        <MenuItem
          emoji="⏰"
          label="Opening hours"
          onPress={() => setScreen("hours")}
        />
        <MenuItem
          emoji="👥"
          label="Manage staff"
          onPress={() => Alert.alert("Coming soon 🚀", "Staff management coming in the next update!")}
          last
        />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={s.version}>SalonQ Dashboard v1.0.0</Text>
    </SafeAreaView>
  );
}

const Row = ({ label, value, last }) => (
  <View style={[s.row, last && { borderBottomWidth: 0 }]}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
  </View>
);

const MenuItem = ({ emoji, label, onPress, last }) => (
  <TouchableOpacity
    style={[s.menuItem, last && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={s.menuEmoji}>{emoji}</Text>
    <Text style={s.menuLabel}>{label}</Text>
    <Text style={s.menuArrow}>›</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#fafafa", paddingHorizontal: 20 },
  title:       { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 20 },
  card:        { backgroundColor: "#1a1a2e", borderRadius: 18, padding: 20, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  salonIcon:   { width: 52, height: 52, borderRadius: 14, backgroundColor: "#ffffff20", alignItems: "center", justifyContent: "center" },
  salonName:   { fontSize: 17, fontWeight: "800", color: "#fff" },
  salonAddr:   { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  infoCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  row:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  rowLabel:    { fontSize: 13, color: "#6b7280" },
  rowValue:    { fontSize: 13, color: "#1a1a2e", fontWeight: "600", flex: 1, textAlign: "right" },
  menu:        { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 16 },
  menuItem:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  menuEmoji:   { fontSize: 20, marginRight: 14 },
  menuLabel:   { flex: 1, fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  menuArrow:   { fontSize: 22, color: "#9ca3af" },
  signOutBtn:  { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#fee2e2" },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  version:     { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 20 },
});
