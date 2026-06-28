// apps/salon/App.js
import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { Platform, ScrollView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { onSnapshot, doc } from "firebase/firestore";
import { onAuthChange, getStaffSalon, firestore } from "./src/firebase";

import QueueDashboard      from "./src/screens/QueueDashboard";
import StylistBoard        from "./src/screens/StylistBoard";
import SalonLogin          from "./src/screens/SalonLogin";
import SalonRegisterScreen from "./src/screens/SalonRegisterScreen";
import SalonSettingsScreen from "./src/screens/SalonSettingsScreen";
import AnalyticsScreen     from "./src/screens/AnalyticsScreen";
import ReviewsScreen       from "./src/screens/ReviewsScreen";
import AdminScreen         from "./src/screens/AdminScreen";

const ADMIN_UID = "nOEaVCR9gGf6uWJ2cwKGZe6gk8J2";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppInner() {
  const [user,    setUser]    = useState(null);
  const [salon,   setSalon]   = useState(null);
  const [salonId, setSalonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.uid === ADMIN_UID;

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        try {
          const linkedSalon = await getStaffSalon(u.uid);
          if (linkedSalon) {
            setSalonId(linkedSalon.id);
            setSalon(linkedSalon);
          }
        } catch (e) {
          console.warn("getStaffSalon error:", e);
        }
      } else {
        setSalon(null);
        setSalonId(null);
      }
      setLoading(false);
    });
  }, []);

  // Live salon subscription
  useEffect(() => {
    if (!salonId) return;
    const unsub = onSnapshot(doc(firestore, "salons", salonId), (snap) => {
      if (snap.exists()) setSalon({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [salonId]);

  const handleSalonCreated = (newSalonId) => setSalonId(newSalonId);

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.logo}>✂️</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={SalonLogin} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Non-admin users with no linked salon must register one first
  if (!salonId && !isAdmin) {
    return <SalonRegisterScreen onSalonCreated={handleSalonCreated} />;
  }

  const tabIcon = (name) => (
    <Text style={{ fontSize: 20 }}>
      {name === "Queue"     ? "⏳"
     : name === "Stylists"  ? "💇"
     : name === "Analytics" ? "📊"
     : name === "Reviews"   ? "⭐"
     : name === "Admin"     ? "🛡️"
     : "⚙️"}
    </Text>
  );

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: () => tabIcon(route.name),
          tabBarActiveTintColor:   "#1a1a2e",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: { height: 60, paddingBottom: 8 },
        })}
      >
        {salonId && (
          <Tab.Screen name="Queue">
            {() => <QueueDashboard salonId={salonId} salon={salon} />}
          </Tab.Screen>
        )}
        {salonId && (
          <Tab.Screen name="Stylists">
            {() => <StylistBoard salon={salon} salonId={salonId} />}
          </Tab.Screen>
        )}
        {salonId && (
          <Tab.Screen name="Analytics">
            {() => <AnalyticsScreen salonId={salonId} salon={salon} />}
          </Tab.Screen>
        )}
        {salonId && (
          <Tab.Screen name="Reviews">
            {() => <ReviewsScreen salonId={salonId} salon={salon} />}
          </Tab.Screen>
        )}
        {salonId && (
          <Tab.Screen name="Settings">
            {() => <SalonSettingsScreen salon={salon} salonId={salonId} />}
          </Tab.Screen>
        )}
        {isAdmin && (
          <Tab.Screen name="Admin" component={AdminScreen} />
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: "#1a1a2e" }} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Something went wrong</Text>
        <Text style={{ color: "#fca5a5", fontSize: 13, fontFamily: "monospace" }}>
          {this.state.error.toString()}
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 16 }}>
          {this.state.error.stack}
        </Text>
      </ScrollView>
    );
  }
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  logo:   { fontSize: 56 },
});
