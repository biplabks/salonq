// apps/customer/src/screens/QueueTrackerScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueueEntry } from "../hooks/useQueue";
import { updateQueueEntry } from "salonq-shared/firebase";
import { formatWait, formatTime } from "salonq-shared/utils";
import { STATUS_LABELS, STATUS_COLORS } from "salonq-shared/models";

export default function QueueTrackerScreen({ route }) {
  const [activeQueue, setActiveQueue] = useState(null);
  const [loaded,      setLoaded]      = useState(false);
  const pulseAnim = new Animated.Value(1);

  // Load from params or AsyncStorage
  useEffect(() => {
    const params = route?.params;
    if (params?.salonId && params?.entryId) {
      setActiveQueue({ salonId: params.salonId, entryId: params.entryId, salonName: params.salonName });
      setLoaded(true);
    } else {
      AsyncStorage.getItem("activeQueue").then((val) => {
        if (val) setActiveQueue(JSON.parse(val));
        setLoaded(true);
      });
    }
  }, [route?.params]);

  // Pulse animation for "called" status
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const { entry, loading } = useQueueEntry(activeQueue?.salonId, activeQueue?.entryId);

  const handleLeaveQueue = () => {
    Alert.alert("Leave queue?", "Are you sure you want to cancel your check-in?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, leave",
        style: "destructive",
        onPress: async () => {
          await updateQueueEntry(activeQueue.salonId, activeQueue.entryId, { status: "no-show" });
          await AsyncStorage.removeItem("activeQueue");
          setActiveQueue(null);
        },
      },
    ]);
  };

  if (!loaded) return <View style={styles.center}><ActivityIndicator color="#1a1a2e" /></View>;

  if (!activeQueue || !entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✂️</Text>
          <Text style={styles.emptyTitle}>No active check-in</Text>
          <Text style={styles.emptySub}>
            Find a salon and join a queue to track your position here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#1a1a2e" size="large" /></View>;

  const statusColor = STATUS_COLORS[entry.status] || "#6b7280";
  const statusLabel = STATUS_LABELS[entry.status] || entry.status;
  const isCalled    = entry.status === "called";
  const isDone      = entry.status === "done" || entry.status === "no-show";

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>Your Queue</Text>

      {/* Salon name */}
      <Text style={styles.salonName}>{activeQueue.salonName}</Text>

      {/* Status card */}
      <Animated.View style={[
        styles.statusCard,
        { borderColor: statusColor, transform: isCalled ? [{ scale: pulseAnim }] : [] }
      ]}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {!isDone && (
          <>
            <Text style={styles.positionLabel}>Position</Text>
            <Text style={styles.positionNumber}>#{entry.position}</Text>
            <Text style={styles.waitLabel}>Estimated wait</Text>
            <Text style={[styles.waitTime, { color: statusColor }]}>
              {formatWait(entry.estimatedWaitMin)}
            </Text>
          </>
        )}

        {isDone && (
          <Text style={styles.doneText}>
            {entry.status === "done"
              ? "✅ Thanks for visiting!"
              : "Your spot was given away."}
          </Text>
        )}

        {entry.joinedAt && (
          <Text style={styles.joinedAt}>Joined at {formatTime(entry.joinedAt)}</Text>
        )}
      </Animated.View>

      {/* Services summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Your booking</Text>
        {(entry.services || []).map((s, i) => (
          <View key={i} style={styles.summaryRow}>
            <Text style={styles.summaryService}>{s.name}</Text>
            <Text style={styles.summaryDuration}>{s.durationMin} min</Text>
          </View>
        ))}
      </View>

      {/* Notification tip */}
      {!isDone && (
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            🔔 We'll notify you when you're up next. You don't need to wait inside.
          </Text>
        </View>
      )}

      {/* Leave queue */}
      {!isDone && entry.status !== "in-service" && (
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveQueue}>
          <Text style={styles.leaveBtnText}>Leave queue</Text>
        </TouchableOpacity>
      )}

      {/* Clear on done */}
      {isDone && (
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={async () => {
            await AsyncStorage.removeItem("activeQueue");
            setActiveQueue(null);
          }}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#fafafa", paddingHorizontal: 20 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  screenTitle:   { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 2 },
  salonName:     { fontSize: 15, color: "#6b7280", marginBottom: 20 },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  statusBadge:     { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 20 },
  statusBadgeText: { fontSize: 14, fontWeight: "700" },
  positionLabel:   { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
  positionNumber:  { fontSize: 64, fontWeight: "900", color: "#1a1a2e", lineHeight: 72 },
  waitLabel:       { fontSize: 13, color: "#9ca3af", marginTop: 8, marginBottom: 2 },
  waitTime:        { fontSize: 28, fontWeight: "800" },
  joinedAt:        { fontSize: 12, color: "#9ca3af", marginTop: 16 },
  doneText:        { fontSize: 20, fontWeight: "700", color: "#1a1a2e", textAlign: "center" },
  summaryCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  summaryTitle:    { fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: "600" },
  summaryRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryService:  { fontSize: 14, color: "#1a1a2e", fontWeight: "500" },
  summaryDuration: { fontSize: 14, color: "#6b7280" },
  tipBox:          { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16 },
  tipText:         { fontSize: 13, color: "#1d4ed8", lineHeight: 18 },
  leaveBtn:        { alignItems: "center", paddingVertical: 14 },
  leaveBtnText:    { color: "#ef4444", fontSize: 14, fontWeight: "600" },
  doneBtn:         { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 12 },
  doneBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptyState:      { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyEmoji:      { fontSize: 56, marginBottom: 16 },
  emptyTitle:      { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 8, textAlign: "center" },
  emptySub:        { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
