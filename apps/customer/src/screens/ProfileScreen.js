// apps/customer/src/screens/ProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getCustomer, logout } from "salonq-shared/firebase";

export default function ProfileScreen({ navigation }) {
  const [customer, setCustomer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (user) {
      getCustomer(user.uid).then((c) => { setCustomer(c); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#1a1a2e" /></View>;

  const name  = customer?.name  || user?.email || "Guest";
  const email = customer?.email || user?.email;
  const phone = customer?.phone;

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Profile</Text>

      {/* Avatar */}
      <View style={s.avatarCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{name}</Text>
        {email && <Text style={s.sub}>{email}</Text>}
        {phone && <Text style={s.sub}>{phone}</Text>}
      </View>

      {/* Menu */}
      <View style={s.menu}>
        <MenuItem
          emoji="🕐"
          label="Visit history"
          onPress={() => navigation.navigate("History")}
        />
        <MenuItem
          emoji="👨‍👩‍👧"
          label="Family members"
          onPress={() => Alert.alert("Coming soon", "Family members feature coming in the next update!")}
        />
        <MenuItem
          emoji="🔔"
          label="Notification settings"
          onPress={() => Alert.alert("Coming soon", "Notification preferences coming soon!")}
        />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const MenuItem = ({ emoji, label, onPress }) => (
  <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
    <Text style={s.menuEmoji}>{emoji}</Text>
    <Text style={s.menuLabel}>{label}</Text>
    <Text style={s.menuArrow}>›</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", paddingHorizontal: 20 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  title:     { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 20 },
  avatarCard:{ backgroundColor: "#fff", borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  avatar:    { width: 72, height: 72, borderRadius: 36, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText:{ fontSize: 30, fontWeight: "800", color: "#fff" },
  name:      { fontSize: 18, fontWeight: "800", color: "#1a1a2e" },
  sub:       { fontSize: 13, color: "#6b7280", marginTop: 2 },
  menu:      { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 16 },
  menuItem:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  menuEmoji: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  menuArrow: { fontSize: 20, color: "#9ca3af" },
  logoutBtn: { alignItems: "center", paddingVertical: 14 },
  logoutText:{ color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
