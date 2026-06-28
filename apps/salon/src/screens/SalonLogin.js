// apps/salon/src/screens/SalonLogin.js
import React, { useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../firebase";

WebBrowser.maybeCompleteAuthSession();

function showError(msg) {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert("Sign-in failed", msg);
}

export default function SalonLogin() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token, access_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token ?? null, access_token ?? null);
      signInWithCredential(auth, credential)
        .catch((err) => showError(err.message));
    }
  }, [response]);

  return (
    <View style={s.container}>
      <View style={s.inner}>
        <Text style={s.logo}>✂️</Text>
        <Text style={s.title}>SalonQ</Text>
        <Text style={s.sub}>Staff Dashboard</Text>

        <Text style={s.subtitle}>Sign in with your Google account to manage your salon queue.</Text>

        <TouchableOpacity
          style={s.googleBtn}
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <Text style={s.googleBtnIcon}>🔵</Text>
          <Text style={s.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#1a1a2e" },
  inner:        { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo:         { fontSize: 52, textAlign: "center", marginBottom: 8 },
  title:        { fontSize: 36, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -1 },
  sub:          { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 32 },
  subtitle:     { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 28, lineHeight: 21 },
  googleBtn:    { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: "#ffffff25" },
  googleBtnIcon:{ fontSize: 20 },
  googleBtnText:{ fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
});
