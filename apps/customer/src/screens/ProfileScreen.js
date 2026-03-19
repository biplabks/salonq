// apps/customer/src/screens/ProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Platform, ScrollView,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getCustomer, logout } from "../firebase";

export default function ProfileScreen({ navigation }) {
  const [customer, setCustomer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (user) {
      getCustomer(user.uid).then((c) => {
        setCustomer(c);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) logout();
    } else {
      Alert.alert("Sign out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: logout },
      ]);
    }
  };

  const handleComingSoon = (feature) => {
    if (Platform.OS === "web") {
      window.alert(`${feature} will be available in the next update!`);
    } else {
      Alert.alert("Coming Soon 🚀", `${feature} will be available in the next update!`);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#1a1a2e" /></View>;
  }

  const name  = customer?.name  || user?.displayName || user?.email || "Guest";
  const email = customer?.email || user?.email;
  const phone = customer?.phone;

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Profile</Text>

      {/* Avatar card */}
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
          onPress={() => navigation.navigate("FamilyMembers")}
          badge={customer?.familyMembers?.length || null}
          last={false}
        />
        <MenuItem
          emoji="🔔"
          label="Notification settings"
          onPress={() => handleComingSoon("Notification settings")}
          last={true}
        />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={s.version}>SalonQ v1.0.0</Text>
    </SafeAreaView>
  );
}

const MenuItem = ({ emoji, label, onPress, last, badge }) => (
  <TouchableOpacity
    style={[s.menuItem, last && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={s.menuEmoji}>{emoji}</Text>
    <Text style={s.menuLabel}>{label}</Text>
    {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View> : null}
    <Text style={s.menuArrow}>›</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fafafa", paddingHorizontal: 20 },
  center:     { flex: 1, alignItems: "center", justifyContent: "center" },
  title:      { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 20 },
  avatarCard: { backgroundColor: "#fff", borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  avatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#fff" },
  name:       { fontSize: 18, fontWeight: "800", color: "#1a1a2e" },
  sub:        { fontSize: 13, color: "#6b7280", marginTop: 2 },
  menu:       { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 16 },
  menuItem:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  menuEmoji:  { fontSize: 20, marginRight: 14 },
  menuLabel:  { flex: 1, fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  menuArrow:  { fontSize: 22, color: "#9ca3af" },
  badge:      { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 8 },
  badgeText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  logoutBtn:  { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#fee2e2" },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  version:    { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 20 },
});