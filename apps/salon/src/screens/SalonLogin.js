// apps/salon/src/screens/SalonLogin.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { loginWithEmail } from "../firebase";

export default function SalonLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert("Please enter email and password"); return; }
    setLoading(true);
    try { await loginWithEmail(email, password); }
    catch (err) { Alert.alert("Login failed", err.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.inner}>
        <Text style={s.logo}>✂️</Text>
        <Text style={s.title}>SalonQ</Text>
        <Text style={s.sub}>Staff Dashboard</Text>
        <TextInput style={s.input} placeholder="Staff email" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#1a1a2e" /> : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  inner:     { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo:      { fontSize: 52, textAlign: "center", marginBottom: 8 },
  title:     { fontSize: 36, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -1 },
  sub:       { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 40 },
  input:     { backgroundColor: "#ffffff15", borderWidth: 1, borderColor: "#ffffff25", borderRadius: 12, padding: 14, fontSize: 15, color: "#fff", marginBottom: 12 },
  btn:       { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText:   { color: "#1a1a2e", fontSize: 16, fontWeight: "800" },
});
