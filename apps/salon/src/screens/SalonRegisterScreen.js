// apps/salon/src/screens/SalonRegisterScreen.js
// Shown when a staff member logs in but has no salon linked yet.
// They can either register a new salon or enter an existing salon ID.

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, SafeAreaView, Platform,
} from "react-native";
import { getAuth } from "firebase/auth";
import { createSalon, linkStaffToSalon, getSalon } from "../firebase";
import LocationPickerWeb from "../components/LocationPickerWeb";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_HOURS = DAYS.reduce((acc, d) => ({
  ...acc,
  [d]: { open: "09:00", close: "19:00", closed: d === "sun" },
}), {});

export default function SalonRegisterScreen({ onSalonCreated }) {
  const [tab,      setTab]      = useState("new"); // "new" | "existing"
  const [loading,  setLoading]  = useState(false);

  // New salon fields
  const [name,     setName]     = useState("");
  const [address,  setAddress]  = useState("");
  const [city,     setCity]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [location, setLocation] = useState({ lat: 0, lng: 0 });

  // Existing salon
  const [salonId,   setSalonId]   = useState("");
  const [foundSalon, setFoundSalon] = useState(null);
  const [finding,    setFinding]    = useState(false);

  const user = getAuth().currentUser;

  const handleCreateSalon = async () => {
    if (!name || !address || !city) {
      if (Platform.OS === "web") window.alert("Please fill in salon name, address and city.");
      else Alert.alert("Missing fields", "Please fill in salon name, address and city.");
      return;
    }
    setLoading(true);
    try {
      const newSalonId = await createSalon(user.uid, user.email, {
        name,
        address,
        city,
        phone,
        photos:   [],
        location,
        hours:    DEFAULT_HOURS,
        services: [
          { id: "s1", name: "Haircut",            price: 300,  durationMin: 30 },
          { id: "s2", name: "Haircut & Blow-dry", price: 500,  durationMin: 45 },
          { id: "s3", name: "Hair Colour",        price: 1500, durationMin: 90 },
          { id: "s4", name: "Beard Trim",         price: 150,  durationMin: 15 },
        ],
        stylists: [],
      });
      if (Platform.OS === "web") {
        window.alert(`Salon created!\nYour salon "${name}" is ready.\nSalon ID: ${newSalonId}`);
        onSalonCreated(newSalonId);
      } else {
        Alert.alert(
          "Salon created! 🎉",
          `Your salon "${name}" is ready.\nSalon ID: ${newSalonId}`,
          [{ text: "Let's go!", onPress: () => onSalonCreated(newSalonId) }]
        );
      }
    } catch (err) {
      if (Platform.OS === "web") window.alert(`Error: ${err.message}`);
      else Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFindSalon = async () => {
    if (!salonId.trim()) {
      if (Platform.OS === "web") window.alert("Please enter a salon ID.");
      else Alert.alert("Missing Salon ID", "Please enter a salon ID.");
      return;
    }
    setFinding(true);
    setFoundSalon(null);
    try {
      const salon = await getSalon(salonId.trim());
      if (salon) {
        setFoundSalon(salon);
      } else {
        if (Platform.OS === "web") window.alert("No salon found with that ID. Please check and try again.");
        else Alert.alert("Not found", "No salon found with that ID. Please check and try again.");
      }
    } catch (err) {
      if (Platform.OS === "web") window.alert(`Error: ${err.message}`);
      else Alert.alert("Error", err.message);
    } finally {
      setFinding(false);
    }
  };

  const handleJoinSalon = async () => {
    if (!foundSalon) return;
    setLoading(true);
    try {
      await linkStaffToSalon(user.uid, foundSalon.id, user.email);
      onSalonCreated(foundSalon.id);
    } catch (err) {
      if (Platform.OS === "web") window.alert(`Error: ${err.message}`);
      else Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>✂️</Text>
        <Text style={s.title}>Set up your salon</Text>
        <Text style={s.sub}>Register a new salon or join an existing one</Text>

        {/* Tab toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, tab === "new" && s.toggleActive]}
            onPress={() => setTab("new")}
          >
            <Text style={[s.toggleText, tab === "new" && s.toggleTextActive]}>New Salon</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, tab === "existing" && s.toggleActive]}
            onPress={() => setTab("existing")}
          >
            <Text style={[s.toggleText, tab === "existing" && s.toggleTextActive]}>Join Existing</Text>
          </TouchableOpacity>
        </View>

        {/* New salon form */}
        {tab === "new" && (
          <View>
            <Text style={s.label}>Salon name *</Text>
            <TextInput style={s.input} placeholder="e.g. Style Studio" value={name} onChangeText={setName} />

            <Text style={s.label}>Address *</Text>
            <TextInput style={s.input} placeholder="e.g. 123 Gulshan Avenue" value={address} onChangeText={setAddress} />

            <Text style={s.label}>City *</Text>
            <TextInput style={s.input} placeholder="e.g. Dhaka" value={city} onChangeText={setCity} />

            <Text style={s.label}>Phone</Text>
            <TextInput style={s.input} placeholder="e.g. +880 1700 000000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={s.label}>Location on map</Text>
            <LocationPickerWeb
              value={location}
              onChange={setLocation}
              darkMode
            />

            <Text style={s.note}>
              📝 Default services and hours will be added automatically. You can edit them later.
            </Text>

            <TouchableOpacity style={s.btn} onPress={handleCreateSalon} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Create Salon →</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Join existing salon */}
        {tab === "existing" && (
          <View>
            <Text style={s.label}>Salon ID</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Paste your salon ID here"
                value={salonId}
                onChangeText={(v) => { setSalonId(v); setFoundSalon(null); }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[s.findBtn, (!salonId.trim() || finding) && { opacity: 0.5 }]}
                onPress={handleFindSalon}
                disabled={!salonId.trim() || finding}
              >
                {finding
                  ? <ActivityIndicator color="#1a1a2e" size="small" />
                  : <Text style={s.findBtnText}>Find</Text>
                }
              </TouchableOpacity>
            </View>
            <Text style={s.note}>
              📝 Ask your salon owner for the Salon ID. It looks like: Sbv44JaRTy8n3sWGX0rb
            </Text>

            {foundSalon && (
              <View style={s.previewCard}>
                <Text style={s.previewEmoji}>✂️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.previewName}>{foundSalon.name}</Text>
                  <Text style={s.previewAddr}>{foundSalon.address}</Text>
                </View>
                <Text style={s.previewCheck}>✓</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.btn, !foundSalon && { opacity: 0.4 }]}
              onPress={handleJoinSalon}
              disabled={loading || !foundSalon}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Join Salon →</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#1a1a2e" },
  inner:           { flexGrow: 1, justifyContent: "center", padding: 28 },
  logo:            { fontSize: 52, textAlign: "center", marginBottom: 8 },
  title:           { fontSize: 28, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -1 },
  sub:             { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 28, marginTop: 4 },
  toggle:          { flexDirection: "row", backgroundColor: "#ffffff15", borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn:       { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleActive:    { backgroundColor: "#fff" },
  toggleText:      { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  toggleTextActive:{ color: "#1a1a2e" },
  label:           { fontSize: 13, color: "#9ca3af", fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input:           { backgroundColor: "#ffffff15", borderWidth: 1, borderColor: "#ffffff25", borderRadius: 12, padding: 14, fontSize: 15, color: "#fff", marginBottom: 4 },
  note:            { fontSize: 12, color: "#6b7280", marginTop: 12, marginBottom: 4, lineHeight: 18 },
  btn:             { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  btnText:         { color: "#1a1a2e", fontSize: 16, fontWeight: "800" },
  findBtn:         { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", minWidth: 64 },
  findBtnText:     { color: "#1a1a2e", fontSize: 14, fontWeight: "800" },
  previewCard:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ffffff20", borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: "#16a34a60" },
  previewEmoji:    { fontSize: 28 },
  previewName:     { fontSize: 15, fontWeight: "700", color: "#fff" },
  previewAddr:     { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  previewCheck:    { fontSize: 20, color: "#16a34a" },
});