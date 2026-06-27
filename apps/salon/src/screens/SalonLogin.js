// apps/salon/src/screens/SalonLogin.js
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { loginWithEmail, registerOrLogin, auth } from "../firebase";

WebBrowser.maybeCompleteAuthSession();

function authErrorMessage(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function SalonLogin() {
  const [mode,     setMode]     = useState("login"); // "login" | "register"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token, access_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token ?? null, access_token ?? null);
      signInWithCredential(auth, credential)
        .catch((err) => showError("Sign-in failed", authErrorMessage(err.code)));
    }
  }, [response]);

  const showError = (title, msg) => {
    if (Platform.OS === "web") window.alert(msg || title);
    else Alert.alert(title, msg);
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      showError("Missing fields", "Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        await registerOrLogin(email, password);
      }
    } catch (err) {
      showError(mode === "login" ? "Sign-in failed" : "Registration failed", authErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.inner}>
        <Text style={s.logo}>✂️</Text>
        <Text style={s.title}>SalonQ</Text>
        <Text style={s.sub}>Staff Dashboard</Text>

        {/* Tab toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, mode === "login" && s.toggleActive]}
            onPress={() => setMode("login")}
          >
            <Text style={[s.toggleText, mode === "login" && s.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, mode === "register" && s.toggleActive]}
            onPress={() => setMode("register")}
          >
            <Text style={[s.toggleText, mode === "register" && s.toggleTextActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.input}
          placeholder="Staff email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#1a1a2e" />
            : <Text style={s.btnText}>{mode === "login" ? "Sign In" : "Create Account →"}</Text>
          }
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity
          style={s.googleBtn}
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <Text style={s.googleBtnIcon}>🔵</Text>
          <Text style={s.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#1a1a2e" },
  inner:            { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo:             { fontSize: 52, textAlign: "center", marginBottom: 8 },
  title:            { fontSize: 36, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -1 },
  sub:              { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 28 },
  toggle:           { flexDirection: "row", backgroundColor: "#ffffff15", borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn:        { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleActive:     { backgroundColor: "#fff" },
  toggleText:       { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  toggleTextActive: { color: "#1a1a2e" },
  input:            { backgroundColor: "#ffffff15", borderWidth: 1, borderColor: "#ffffff25", borderRadius: 12, padding: 14, fontSize: 15, color: "#fff", marginBottom: 12 },
  btn:              { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText:          { color: "#1a1a2e", fontSize: 16, fontWeight: "800" },
  divider:          { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: "#ffffff25" },
  dividerText:      { fontSize: 13, color: "#6b7280" },
  googleBtn:        { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, borderWidth: 1.5, borderColor: "#ffffff25" },
  googleBtnIcon:    { fontSize: 20 },
  googleBtnText:    { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
});
