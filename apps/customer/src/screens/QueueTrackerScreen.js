// apps/customer/src/screens/QueueTrackerScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, Animated, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueueEntry } from "../hooks/useQueue";
import { updateQueueEntry } from "../firebase";
import { formatWait, formatTime, STATUS_LABELS, STATUS_COLORS } from "../utils";

export default function QueueTrackerScreen({ route, navigation }) {
  const [activeQueue, setActiveQueue] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load active queue from params or AsyncStorage
  useEffect(() => {
    const loadQueue = async () => {
      const params = route?.params;
      if (params?.salonId && params?.entryId) {
        setActiveQueue({
          salonId:   params.salonId,
          entryId:   params.entryId,
          salonName: params.salonName,
        });
        setLoaded(true);
      } else {
        try {
          const val = await AsyncStorage.getItem("activeQueue");
          if (val) setActiveQueue(JSON.parse(val));
        } catch (e) {
          console.error("Failed to load activeQueue:", e);
        } finally {
          setLoaded(true);
        }
      }
    };
    loadQueue();
  }, [route?.params]);

  // Pulse animation for "called" status
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const { entry, loading } = useQueueEntry(activeQueue?.salonId, activeQueue?.entryId);

  // Auto-clear AsyncStorage when the entry is done/no-show so the customer can join again
  useEffect(() => {
    if (entry && (entry.status === "done" || entry.status === "no-show")) {
      AsyncStorage.removeItem("activeQueue").catch(() => {});
    }
  }, [entry?.status]);

  // Clear active queue from storage and state
  const clearQueue = async () => {
    try {
      await AsyncStorage.removeItem("activeQueue");
    } catch (e) {
      console.error("Failed to clear activeQueue:", e);
    }
    setActiveQueue(null);
  };

  // Leave queue handler
  const doLeave = async () => {
    try {
      await updateQueueEntry(activeQueue.salonId, activeQueue.entryId, {
        status: "no-show",
      });
    } catch (e) {
      console.error("Failed to update queue entry:", e);
    } finally {
      await clearQueue();
    }
  };

  const handleLeave = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to cancel your check-in?")) {
        doLeave();
      }
    } else {
      Alert.alert(
        "Leave queue?",
        "Are you sure you want to cancel your check-in?",
        [
          { text: "No, stay", style: "cancel" },
          { text: "Yes, leave", style: "destructive", onPress: doLeave },
        ]
      );
    }
  };

  const handleViewReceipt = () => {
    navigation.navigate("Receipt", {
      salonId:   activeQueue.salonId,
      entryId:   activeQueue.entryId,
      salonName: activeQueue.salonName,
    });
  };

  // ── Loading state ──
  if (!loaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#1a1a2e" size="large" />
      </View>
    );
  }

  // ── No active queue ──
  if (!activeQueue) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>✂️</Text>
          <Text style={s.emptyTitle}>No active check-in</Text>
          <Text style={s.emptySub}>
            Find a salon and join a queue to track your position here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Waiting for entry to load ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#1a1a2e" size="large" />
      </View>
    );
  }

  // ── Entry not found ──
  if (!entry) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>⚠️</Text>
          <Text style={s.emptyTitle}>Queue entry not found</Text>
          <Text style={s.emptySub}>Your queue entry may have been removed.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={clearQueue}>
            <Text style={s.doneBtnText}>Clear & Start Over</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[entry.status] || "#6b7280";
  const statusLabel = STATUS_LABELS[entry.status] || entry.status;
  const isCalled    = entry.status === "called";
  const isDone      = entry.status === "done" || entry.status === "no-show";

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Your Queue</Text>
      <Text style={s.salonName}>{activeQueue.salonName}</Text>

      {/* Status card */}
      <Animated.View style={[
        s.card,
        { borderColor: statusColor },
        isCalled && { transform: [{ scale: pulseAnim }] },
      ]}>
        <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {!isDone && <>
          <Text style={s.posLabel}>Position</Text>
          <Text style={s.posNum}>#{entry.position}</Text>
          <Text style={s.waitLabel}>Estimated wait</Text>
          <Text style={[s.waitTime, { color: statusColor }]}>
            {formatWait(entry.estimatedWaitMin)}
          </Text>
        </>}

        {isDone && (
          <Text style={s.doneText}>
            {entry.status === "done" ? "✅ Thanks for visiting!" : "Your spot was given away."}
          </Text>
        )}

        {entry.joinedAt && (
          <Text style={s.joinedAt}>Joined at {formatTime(entry.joinedAt)}</Text>
        )}
      </Animated.View>

      {/* Services summary */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Your booking</Text>
        {(entry.services || []).map((sv, i) => (
          <View key={i} style={s.summaryRow}>
            <Text style={s.summaryService}>{sv.name}</Text>
            <Text style={s.summaryDuration}>{sv.durationMin} min</Text>
          </View>
        ))}
      </View>

      {/* Tip */}
      {!isDone && (
        <View style={s.tip}>
          <Text style={s.tipText}>
            🔔 We'll notify you when you're up next. You don't need to wait inside.
          </Text>
        </View>
      )}

      {/* View Receipt button when done */}
      {entry.status === "done" && (
        <TouchableOpacity style={s.receiptBtn} onPress={handleViewReceipt}>
          <Text style={s.receiptBtnText}>🧾 View Receipt</Text>
        </TouchableOpacity>
      )}

      {/* Leave queue button */}
      {!isDone && entry.status !== "in-service" && (
        <TouchableOpacity style={s.leaveBtn} onPress={handleLeave}>
          <Text style={s.leaveBtnText}>Leave queue</Text>
        </TouchableOpacity>
      )}

      {/* Done button */}
      {isDone && (
        <TouchableOpacity style={s.doneBtn} onPress={clearQueue}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa", paddingHorizontal: 20 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 26, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 2 },
  salonName:      { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  card:           { backgroundColor: "#fff", borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 2, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  statusBadge:    { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 20 },
  statusText:     { fontSize: 14, fontWeight: "700" },
  posLabel:       { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
  posNum:         { fontSize: 64, fontWeight: "900", color: "#1a1a2e", lineHeight: 72 },
  waitLabel:      { fontSize: 13, color: "#9ca3af", marginTop: 8, marginBottom: 2 },
  waitTime:       { fontSize: 28, fontWeight: "800" },
  joinedAt:       { fontSize: 12, color: "#9ca3af", marginTop: 16 },
  doneText:       { fontSize: 20, fontWeight: "700", color: "#1a1a2e", textAlign: "center" },
  summaryCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  summaryTitle:   { fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: "600" },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryService: { fontSize: 14, color: "#1a1a2e", fontWeight: "500" },
  summaryDuration:{ fontSize: 14, color: "#6b7280" },
  tip:            { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16 },
  tipText:        { fontSize: 13, color: "#1d4ed8", lineHeight: 18 },
  receiptBtn:     { backgroundColor: "#f0fdf4", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#bbf7d0" },
  receiptBtnText: { color: "#16a34a", fontSize: 15, fontWeight: "700" },
  leaveBtn:       { alignItems: "center", paddingVertical: 14 },
  leaveBtnText:   { color: "#ef4444", fontSize: 15, fontWeight: "600" },
  doneBtn:        { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 12 },
  doneBtnText:    { color: "#fff", fontSize: 16, fontWeight: "700" },
  empty:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:     { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 8, textAlign: "center" },
  emptySub:       { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
});
