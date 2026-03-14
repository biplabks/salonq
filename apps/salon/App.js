// apps/salon/App.js
import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import {
  onAuthChange, getSalon,
  firestore,
} from "./src/firebase";
import { onSnapshot, doc } from "firebase/firestore";
import QueueDashboard from "./src/screens/QueueDashboard";
import StylistBoard   from "./src/screens/StylistBoard";
import SalonLogin     from "./src/screens/SalonLogin";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ⬇️ Your salon ID from Firestore
const SALON_ID = "Sbv44JaRTy8n3sWGX0rb";

export default function App() {
  const [user,    setUser]    = useState(null);
  const [salon,   setSalon]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Timeout fallback — if onAuthStateChanged never fires, unblock the UI
    const timeout = setTimeout(() => {
      setAuthError("Auth timed out — check console for Firebase errors");
      setLoading(false);
    }, 6000);

    let unsub;
    try {
      unsub = onAuthChange((u) => {
        clearTimeout(timeout);
        setUser(u);
        setLoading(false);
      });
    } catch (e) {
      clearTimeout(timeout);
      setAuthError(String(e));
      setLoading(false);
    }

    return () => { clearTimeout(timeout); unsub?.(); };
  }, []);

  // Subscribe to salon document in real-time so stylists always stay fresh
  useEffect(() => {
    if (!SALON_ID) return;
    const unsub = onSnapshot(doc(firestore, "salons", SALON_ID), (snap) => {
      if (snap.exists()) {
        setSalon({ id: snap.id, ...snap.data() });
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.logo}>✂️</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (authError) {
    return (
      <View style={s.center}>
        <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center", padding: 24 }}>
          {authError}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={SalonLogin} />
        </Stack.Navigator>
      ) : (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>
                {route.name === "Queue" ? "⏳" : "💇"}
              </Text>
            ),
            tabBarActiveTintColor:   "#1a1a2e",
            tabBarInactiveTintColor: "#9ca3af",
            tabBarStyle: { height: 60, paddingBottom: 8 },
          })}
        >
          <Tab.Screen name="Queue">
            {() => <QueueDashboard salonId={SALON_ID} salon={salon} />}
          </Tab.Screen>
          <Tab.Screen name="Stylists">
            {() => <StylistBoard salon={salon} salonId={SALON_ID} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  logo:   { fontSize: 56 },
});