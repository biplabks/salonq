// apps/customer/src/screens/NotificationSettingsScreen.js
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Switch, ActivityIndicator, Platform, Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  registerForPushNotifications,
  REMINDER_ENABLED_KEY,
} from "../services/notifications";

export default function NotificationSettingsScreen({ navigation }) {
  const [permStatus,      setPermStatus]      = useState(null);
  const [canAskAgain,     setCanAskAgain]     = useState(true);
  const [enabling,        setEnabling]        = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const checkPermission = useCallback(async () => {
    if (!Device.isDevice || Platform.OS === "web") {
      setPermStatus("web");
      return;
    }
    const { status, canAskAgain: can } = await Notifications.getPermissionsAsync();
    setPermStatus(status);
    setCanAskAgain(can);
  }, []);

  // Re-check on focus so coming back from iOS Settings updates the status.
  useFocusEffect(useCallback(() => {
    checkPermission();
    AsyncStorage.getItem(REMINDER_ENABLED_KEY).then((val) => {
      setReminderEnabled(val === null ? true : val === "true");
    });
  }, [checkPermission]));

  const handleEnableNotifications = async () => {
    if (!canAskAgain) {
      Linking.openSettings();
      return;
    }
    setEnabling(true);
    await registerForPushNotifications();
    await checkPermission();
    setEnabling(false);
  };

  const toggleReminder = async (value) => {
    setReminderEnabled(value);
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, String(value));
  };

  const isGranted = permStatus === "granted";
  const isWeb     = permStatus === "web";

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Section 1: Queue status alerts — always on */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Queue status alerts</Text>
        <Text style={s.sectionSub}>
          Critical alerts for "Your turn is coming", "You're being called", and early-ready slots.
          These cannot be turned off — they're the core feature.
        </Text>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Push notifications</Text>
            {permStatus !== null && (
              <Text style={[s.rowSub, { color: isGranted ? "#16a34a" : "#ef4444" }]}>
                {isWeb
                  ? "Not available on web"
                  : isGranted
                    ? "Enabled — you'll be notified when it's your turn"
                    : "Disabled — you won't receive queue alerts"}
              </Text>
            )}
          </View>
          <View style={[s.statusDot, { backgroundColor: isGranted ? "#16a34a" : "#d1d5db" }]} />
        </View>

        {!isGranted && !isWeb && (
          <TouchableOpacity
            style={[s.enableBtn, enabling && { opacity: 0.6 }]}
            onPress={handleEnableNotifications}
            disabled={enabling}
          >
            {enabling
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.enableBtnText}>
                  {canAskAgain ? "Enable Notifications" : "Open Settings →"}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Section 2: 10-minute reminder — toggleable */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>10-minute heads-up</Text>
        <Text style={s.sectionSub}>
          A local reminder fires 10 minutes before your estimated turn, prompting you to head to the salon.
          Works even when the app is closed.
        </Text>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Remind me before my turn</Text>
            <Text style={s.rowSub}>Scheduled on your device when you join a queue</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={toggleReminder}
            trackColor={{ false: "#e5e7eb", true: "#1a1a2e" }}
            thumbColor="#fff"
          />
        </View>

        {reminderEnabled && !isGranted && !isWeb && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>
              Enable notifications above so the reminder can reach you when the app is closed.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#fafafa" },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:          { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:         { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  section:       { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginTop: 20, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  sectionTitle:  { fontSize: 15, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  sectionSub:    { fontSize: 13, color: "#6b7280", lineHeight: 18, marginBottom: 14 },
  row:           { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel:      { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  rowSub:        { fontSize: 12, color: "#9ca3af", marginTop: 2, lineHeight: 16 },
  statusDot:     { width: 12, height: 12, borderRadius: 6 },
  enableBtn:     { backgroundColor: "#1a1a2e", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  enableBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  warningBox:    { backgroundColor: "#fff7ed", borderRadius: 10, padding: 12, marginTop: 14, flexDirection: "row", gap: 8 },
  warningText:   { flex: 1, fontSize: 12, color: "#d97706", lineHeight: 17 },
});
