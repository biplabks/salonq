// apps/customer/src/navigation/index.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, ActivityIndicator, View } from "react-native";

import HomeScreen         from "../screens/HomeScreen";
import SalonDetailScreen  from "../screens/SalonDetailScreen";
import CheckInScreen      from "../screens/CheckInScreen";
import QueueTrackerScreen from "../screens/QueueTrackerScreen";
import ReceiptScreen      from "../screens/ReceiptScreen";
import ProfileScreen        from "../screens/ProfileScreen";
import LoginScreen          from "../screens/LoginScreen";
import HistoryScreen        from "../screens/HistoryScreen";
import FamilyMembersScreen  from "../screens/FamilyMembersScreen";
import { useAuth }        from "../hooks/useAuth";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"        component={HomeScreen} />
      <Stack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <Stack.Screen name="CheckIn"     component={CheckInScreen} />
    </Stack.Navigator>
  );
}

function QueueStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="QueueTracker" component={QueueTrackerScreen} />
      <Stack.Screen name="Receipt"      component={ReceiptScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain"   component={ProfileScreen} />
      <Stack.Screen name="History"       component={HistoryScreen} />
      <Stack.Screen name="FamilyMembers" component={FamilyMembersScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>
            {route.name === "Explore" ? "🗺️" : route.name === "Queue" ? "⏳" : "👤"}
          </Text>
        ),
        tabBarActiveTintColor:   "#1a1a2e",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle:             { height: 60, paddingBottom: 8 },
      })}
    >
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Queue"   component={QueueStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main"  component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
