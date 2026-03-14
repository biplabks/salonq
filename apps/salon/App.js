// apps/salon/App.js
import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
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

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function App() {
  const [user,    setUser]    = useState(null);
  const [salon,   setSalon]   = useState(null);
  const [salonId, setSalonId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth state
  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        // Check if this staff member has a salon linked
        const linkedSalon = await getStaffSalon(u.uid);
        if (linkedSalon) {
          setSalonId(linkedSalon.id);
          setSalon(linkedSalon);
        }
      } else {
        setSalon(null);
        setSalonId(null);
      }
      setLoading(false);
    });
  }, []);

  // Subscribe to salon document in real-time once we have a salonId
  useEffect(() => {
    if (!salonId) return;
    const unsub = onSnapshot(doc(firestore, "salons", salonId), (snap) => {
      if (snap.exists()) setSalon({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [salonId]);

  // Called after salon registration or joining
  const handleSalonCreated = (newSalonId) => {
    setSalonId(newSalonId);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.logo}>✂️</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  // Not logged in → show login
  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={SalonLogin} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Logged in but no salon linked → show registration
  if (!salonId) {
    return <SalonRegisterScreen onSalonCreated={handleSalonCreated} />;
  }

  // Logged in with salon → show dashboard
  return (
    <NavigationContainer>
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
          {() => <QueueDashboard salonId={salonId} salon={salon} />}
        </Tab.Screen>
        <Tab.Screen name="Stylists">
          {() => <StylistBoard salon={salon} salonId={salonId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  logo:   { fontSize: 56 },
});