// apps/salon/App.js
// Root of the Salon Dashboard app.

import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { onAuthChange, getSalon, loginWithEmail } from "salonq-shared/firebase";

// Screens
import QueueDashboard from "./src/screens/QueueDashboard";
import StylistBoard   from "./src/screens/StylistBoard";
import SalonLogin     from "./src/screens/SalonLogin";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SALON_ID = "REPLACE_WITH_YOUR_SALON_ID"; // ← Set this after creating your salon in Firestore

export default function App() {
  const [user,    setUser]    = useState(null);
  const [salon,   setSalon]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const s = await getSalon(SALON_ID);
        setSalon(s);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>✂️</Text>
        <ActivityIndicator color="#1a1a2e" style={{ marginTop: 16 }} />
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
            tabBarIcon: () => (
              <Text style={{ fontSize: 20 }}>
                {route.name === "Queue" ? "⏳" : route.name === "Stylists" ? "💇" : "⚙️"}
              </Text>
            ),
            tabBarActiveTintColor: "#1a1a2e",
            tabBarStyle: { height: 60, paddingBottom: 8 },
            headerShown: false,
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  logo:   { fontSize: 56 },
});
