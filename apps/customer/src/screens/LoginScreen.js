// apps/customer/src/screens/LoginScreen.js
import React, { useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../firebase";

WebBrowser.maybeCompleteAuthSession();

function showError(msg) {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert("Sign-in failed", msg);
}

export default function LoginScreen() {
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
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.brand}
      >
        <Text style={s.logo}>✂️</Text>
        <Text style={s.appName}>SalonQ</Text>
        <Text style={s.tagline}>Skip the wait. Walk in ready.</Text>
      </LinearGradient>

      <View style={s.body}>
        <Text style={s.subtitle}>Sign in to book your spot at any salon, anytime.</Text>
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
  container:    { flex: 1, backgroundColor: "#fafafa" },
  brand:        { alignItems: "center", paddingTop: 100, paddingBottom: 60, paddingHorizontal: 28 },
  logo:         { fontSize: 56 },
  appName:      { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: -1, marginTop: 8 },
  tagline:      { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  body:         { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  subtitle:     { fontSize: 15, color: "#6b7280", textAlign: "center", marginBottom: 28, lineHeight: 22 },
  googleBtn:    { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: "#e5e7eb" },
  googleBtnIcon:{ fontSize: 20 },
  googleBtnText:{ fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
});
