// apps/customer/App.js
import React, { useEffect } from "react";
import { Platform, Text, View, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/index";

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

function AppInner() {
  // Must run after the native runtime is ready (inside a component, not module-level)
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
