// apps/customer/src/screens/LoginScreen.js
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { loginWithEmail, registerWithEmail, saveCustomer } from "../firebase";

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { Alert.alert("Missing fields", "Please enter email and password."); return; }
    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!name) { Alert.alert("Missing name"); setLoading(false); return; }
        const cred = await registerWithEmail(email, password);
        await saveCustomer(cred.user.uid, { name, email, phone, familyMembers: [] });
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <Text style={s.logo}>✂️</Text>
          <Text style={s.appName}>SalonQ</Text>
          <Text style={s.tagline}>Skip the wait. Walk in ready.</Text>
        </View>

        <View style={s.toggle}>
          <TouchableOpacity style={[s.toggleBtn, isLogin && s.toggleActive]} onPress={() => setIsLogin(true)}>
            <Text style={[s.toggleText, isLogin && s.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggleBtn, !isLogin && s.toggleActive]} onPress={() => setIsLogin(false)}>
            <Text style={[s.toggleText, !isLogin && s.toggleTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        {!isLogin && (
          <TextInput style={s.input} placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <TextInput style={s.input} placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        {!isLogin && (
          <TextInput style={s.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        )}
        <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isLogin ? "Sign In" : "Create Account"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fafafa" },
  inner:           { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  brand:           { alignItems: "center", marginBottom: 36 },
  logo:            { fontSize: 56 },
  appName:         { fontSize: 34, fontWeight: "800", color: "#1a1a2e", letterSpacing: -1 },
  tagline:         { fontSize: 14, color: "#6b7280", marginTop: 4 },
  toggle:          { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn:       { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleActive:    { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText:      { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  toggleTextActive:{ color: "#1a1a2e" },
  input:           { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: "#1a1a2e" },
  btn:             { backgroundColor: "#1a1a2e", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText:         { color: "#fff", fontSize: 16, fontWeight: "700" },
});
