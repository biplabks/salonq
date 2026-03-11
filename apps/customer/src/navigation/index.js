// apps/customer/src/navigation/index.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";

// Screens
import HomeScreen       from "../screens/HomeScreen";
import SalonDetailScreen from "../screens/SalonDetailScreen";
import CheckInScreen    from "../screens/CheckInScreen";
import QueueTrackerScreen from "../screens/QueueTrackerScreen";
import ProfileScreen    from "../screens/ProfileScreen";
import LoginScreen      from "../screens/LoginScreen";
import HistoryScreen    from "../screens/HistoryScreen";

import { useAuth } from "../hooks/useAuth";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICON = {
  Explore: "🗺️",
  Queue:   "⏳",
  Profile: "👤",
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name]}</Text>,
        tabBarActiveTintColor: "#1a1a2e",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          borderTopColor: "#f3f4f6",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Queue"   component={QueueTrackerScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"        component={HomeScreen} />
      <Stack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <Stack.Screen name="CheckIn"     component={CheckInScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="History"     component={HistoryScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
