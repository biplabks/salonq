// apps/salon/src/screens/QueueDashboard.js
// Group booking support — per-person stylist assignment

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Modal, TextInput, ActivityIndicator, ScrollView,
} from "react-native";
import {
  subscribeToQueue, updateQueueEntry, completeService,
  saveSalon, getSalon,
  serverTimestamp, addDoc, collection, firestore,
} from "../firebase";
import { getDocs, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { recalculateQueue } from "../utils/waitTimeEngine";
import { crossAlert } from "../utils/crossAlert";
import {
  sendPushNotification,
  sendBulkPushNotifications,
  NOTIFICATIONS,
} from "../services/pushService";
import PaymentScreen from "./PaymentScreen";

const STATUS_COLORS = {
  waiting:           "#F59E0B",
  called:            "#10B981",
  "in-service":      "#3B82F6",
  done:              "#6B7280",
  "payment-pending": "#8B5CF6",
  paid:              "#16a34a",
  "no-show":         "#EF4444",
};

const formatWait  = (min) => !min || min <= 0 ? "Now" : min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
const formatPrice = (amount) => `৳${Number(amount || 0).toLocaleString()}`;

const RELATIONSHIP_EMOJI = {
  Spouse: "💑", Child: "👶", Parent: "👨‍👩‍👦",
  Sibling: "👫", Grandparent: "👴", Grandchild: "🧒",
  Friend: "👥", Other: "👤",
};

// ── Group Stylist Picker Modal ─────────────────────────────────────────────────
function GroupStylistModal({ visible, onClose, onConfirm, entry, stylists }) {
  const members = entry?.groupMembers || [];
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    if (visible && entry) {
      const initial = {};
      (entry.groupMembers || []).forEach((m) => {
        initial[m.id] = { stylistId: m.stylistId || null, stylistName: m.stylistName || null };
      });
      setAssignments(initial);
    }
  }, [visible, entry]);

  const assignStylist = (memberId, stylist) => {
    setAssignments((prev) => ({
      ...prev,
      [memberId]: { stylistId: stylist?.id || null, stylistName: stylist?.name || null },
    }));
  };

  const assignedCount = Object.values(assignments).filter((a) => a !== undefined).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={gm.container}>
        <View style={gm.header}>
          <View style={{ flex: 1 }}>
            <Text style={gm.title}>Assign Stylists</Text>
            <Text style={gm.sub}>Group of {members.length} — one stylist per person</Text>
          </View>
          <TouchableOpacity style={gm.closeBtn} onPress={onClose}>
            <Text style={gm.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={gm.progressBar}>
          <View style={[gm.progressFill, { width: `${(assignedCount / Math.max(members.length, 1)) * 100}%` }]} />
        </View>
        <Text style={gm.progressText}>{assignedCount} of {members.length} assigned</Text>

        <ScrollView contentContainerStyle={gm.content}>
          {members.map((member, index) => {
            const assignment = assignments[member.id] || {};
            const isDone = !!assignment.stylistId || assignment.stylistId === null && assignments[member.id] !== undefined;
            return (
              <View key={member.id} style={[gm.memberCard, isDone && gm.memberCardDone]}>
                {/* Person row */}
                <View style={gm.memberHeader}>
                  <View style={gm.memberAvatar}>
                    <Text style={{ fontSize: 20 }}>
                      {member.isSelf ? "😊" : (RELATIONSHIP_EMOJI[member.relationship] || "👤")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={gm.memberName}>{member.name}</Text>
                    <Text style={gm.memberServices} numberOfLines={1}>
                      {(member.services || []).map((sv) => sv.name).join(", ")}
                    </Text>
                  </View>
                  {assignment.stylistName !== undefined && (
                    <View style={gm.assignedBadge}>
                      <Text style={gm.assignedText}>
                        {assignment.stylistName ? `✓ ${assignment.stylistName}` : "✓ Any"}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Stylist chips */}
                <View style={gm.chipsRow}>
                  <TouchableOpacity
                    style={[gm.chip, assignment.stylistId === null && assignments[member.id] !== undefined && gm.chipSel]}
                    onPress={() => assignStylist(member.id, null)}
                  >
                    <Text style={[gm.chipText, assignment.stylistId === null && assignments[member.id] !== undefined && gm.chipTextSel]}>
                      Any
                    </Text>
                  </TouchableOpacity>
                  {(stylists || []).filter((s) => s.status !== "off").map((stylist) => {
                    const selected = assignment.stylistId === stylist.id;
                    const isAvailable = stylist.status === "available";
                    return (
                      <TouchableOpacity
                        key={stylist.id}
                        style={[gm.chip, selected && gm.chipSel]}
                        onPress={() => assignStylist(member.id, stylist)}
                      >
                        <View style={[gm.chipDot, { backgroundColor: isAvailable ? "#16a34a" : "#f59e0b" }]} />
                        <Text style={[gm.chipText, selected && gm.chipTextSel]}>{stylist.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={gm.footer}>
          <TouchableOpacity style={gm.confirmBtn} onPress={() => onConfirm(assignments)}>
            <Text style={gm.confirmBtnText}>Start Services for {members.length} →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const gm = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa" },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#fff" },
  title:          { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  sub:            { fontSize: 13, color: "#6b7280", marginTop: 2 },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  closeIcon:      { fontSize: 14, color: "#6b7280", fontWeight: "700" },
  progressBar:    { height: 4, backgroundColor: "#f3f4f6" },
  progressFill:   { height: 4, backgroundColor: "#1a1a2e", borderRadius: 2 },
  progressText:   { fontSize: 12, color: "#6b7280", textAlign: "center", paddingVertical: 8, fontWeight: "600" },
  content:        { padding: 16, gap: 12, paddingBottom: 24 },
  memberCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  memberCardDone: { borderColor: "#bbf7d0" },
  memberHeader:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  memberAvatar:   { width: 44, height: 44, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  memberName:     { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  memberServices: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  assignedBadge:  { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  assignedText:   { fontSize: 11, color: "#16a34a", fontWeight: "700" },
  chipsRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:           { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: "#e5e7eb" },
  chipSel:        { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText:       { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  chipTextSel:    { color: "#fff", fontWeight: "700" },
  chipDot:        { width: 6, height: 6, borderRadius: 3 },
  footer:         { padding: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6", backgroundColor: "#fff" },
  confirmBtn:     { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

// ── Single Stylist Picker Modal ────────────────────────────────────────────────
function StylistPickerModal({ visible, onClose, onSelect, stylists, entryName }) {
  const available = (stylists || []).filter((s) => s.status !== "off");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={sp.container}>
        <View style={sp.header}>
          <View style={{ flex: 1 }}>
            <Text style={sp.title}>Assign Stylist</Text>
            {entryName ? <Text style={sp.sub}>Serving {entryName}</Text> : null}
          </View>
          <TouchableOpacity style={sp.closeBtn} onPress={onClose}>
            <Text style={sp.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={sp.content}>
          {available.map((stylist) => {
            const isAvailable = stylist.status === "available";
            return (
              <TouchableOpacity key={stylist.id} style={sp.row} onPress={() => onSelect(stylist)}>
                <View style={sp.avatar}>
                  <Text style={{ fontSize: 24 }}>💇</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sp.name}>{stylist.name}</Text>
                  <View style={sp.statusRow}>
                    <View style={[sp.dot, { backgroundColor: isAvailable ? "#16a34a" : "#f59e0b" }]} />
                    <Text style={[sp.statusText, { color: isAvailable ? "#16a34a" : "#d97706" }]}>
                      {isAvailable ? "Available" : "Busy"}
                    </Text>
                  </View>
                </View>
                <Text style={sp.arrow}>›</Text>
              </TouchableOpacity>
            );
          })}

          {available.length === 0 && (
            <View style={sp.empty}>
              <Text style={sp.emptyEmoji}>😔</Text>
              <Text style={sp.emptyText}>No stylists available</Text>
            </View>
          )}
        </ScrollView>

        <View style={sp.footer}>
          <TouchableOpacity style={sp.skipBtn} onPress={() => onSelect(null)}>
            <Text style={sp.skipText}>Auto-assign first available stylist</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const sp = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fafafa" },
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#fff" },
  title:      { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  sub:        { fontSize: 13, color: "#6b7280", marginTop: 2 },
  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  closeIcon:  { fontSize: 14, color: "#6b7280", fontWeight: "700" },
  content:    { padding: 16, gap: 10, paddingBottom: 24 },
  row:        { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", gap: 14 },
  avatar:     { width: 52, height: 52, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  name:       { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  statusRow:  { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  arrow:      { fontSize: 22, color: "#d1d5db" },
  empty:      { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyText:  { fontSize: 14, color: "#9ca3af" },
  footer:     { padding: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6", backgroundColor: "#fff" },
  skipBtn:    { backgroundColor: "#f3f4f6", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  skipText:   { fontSize: 14, color: "#6b7280", fontWeight: "600" },
});

// ── Walk-in Modal ─────────────────────────────────────────────────────────────
function WalkInModal({ visible, onClose, salon, salonId }) {
  const [name,     setName]     = useState("");
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = (sv) => setSelected((prev) =>
    prev.find((s) => s.id === sv.id) ? prev.filter((s) => s.id !== sv.id) : [...prev, sv]
  );

  const handleAdd = async () => {
    if (!name || !selected.length) {
      crossAlert("Missing info", "Please enter a name and select at least one service.");
      return;
    }
    setLoading(true);
    try {
      const queueRef      = collection(firestore, "salons", salonId, "queue");
      const waitingSnap   = await getDocs(query(queueRef, where("status", "==", "waiting")));
      const nextPosition  = waitingSnap.size + 1;
      const totalDuration = selected.reduce((s, sv) => s + (sv.durationMin || 30), 0);
      const totalPrice    = selected.reduce((s, sv) => s + (sv.price || 0), 0);
      const estimatedWaitMin = waitingSnap.docs
        .map((d) => d.data())
        .reduce((sum, e) => sum + (e.services || []).reduce((s, sv) => s + (sv.durationMin || 30), 0), 0);
      await addDoc(queueRef, {
        customerId: null, customerName: name, services: selected,
        stylistId: null, status: "waiting", type: "walk-in",
        position: nextPosition, estimatedWaitMin,
        totalPrice, paymentStatus: "pending", isGroupBooking: false, peopleCount: 1,
        joinedAt: serverTimestamp(), calledAt: null, completedAt: null,
      });
      setName(""); setSelected([]); onClose();
    } catch (err) {
      crossAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={m.container}>
        <View style={m.header}>
          <Text style={m.title}>Add Walk-in</Text>
          <TouchableOpacity onPress={onClose}><Text style={m.close}>✕</Text></TouchableOpacity>
        </View>
        <TextInput style={m.input} placeholder="Customer name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Text style={m.label}>Select Services</Text>
        {(salon?.services || []).map((sv) => {
          const sel = !!selected.find((s) => s.id === sv.id);
          return (
            <TouchableOpacity key={sv.id} style={[m.row, sel && m.rowSel]} onPress={() => toggle(sv)}>
              <View>
                <Text style={[m.rowText, sel && { color: "#fff" }]}>{sv.name}</Text>
                <Text style={[m.rowSub,  sel && { color: "#e5e7eb" }]}>{sv.durationMin} min</Text>
              </View>
              {sel && <Text style={{ color: "#fff", fontSize: 16 }}>✓</Text>}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={m.btn} onPress={handleAdd} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>Add to Queue</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 20 },
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title:     { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  close:     { fontSize: 20, color: "#6b7280" },
  input:     { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20 },
  label:     { fontSize: 14, fontWeight: "700", color: "#6b7280", marginBottom: 10 },
  row:       { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rowSel:    { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  rowText:   { fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  rowSub:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  btn:       { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  btnText:   { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ── Main Queue Dashboard ───────────────────────────────────────────────────────
export default function QueueDashboard({ salonId, salon }) {
  const [queue,         setQueue]         = useState([]);
  const [doneQueue,     setDoneQueue]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showWalkIn,    setShowWalkIn]    = useState(false);
  const [stylistPicker, setStylistPicker] = useState(null);
  const [groupPicker,   setGroupPicker]   = useState(null);
  const [paymentEntry,  setPaymentEntry]  = useState(null);
  const prevQueueLen = useRef(null);

  const availableStylists = (salon?.stylists || []).filter(
    (s) => s.status === "available" || s.status === "busy"
  ).length || 1;

  useEffect(() => {
    if (!salonId) return;
    return subscribeToQueue(salonId, async (entries) => {
      const prevQueue = queue;
      setQueue(entries);
      setLoading(false);
      if (prevQueue.length > 0) {
        const changes = entries.filter((e) => {
          const prev = prevQueue.find((p) => p.id === e.id);
          return prev && prev.position !== e.position && e.pushToken;
        });
        if (changes.length > 0) {
          await sendBulkPushNotifications(changes.map((e) => {
            const notif = e.position === 1
              ? NOTIFICATIONS.youreNext(salon?.name || "the salon")
              : NOTIFICATIONS.positionUpdate(e.position, e.estimatedWaitMin);
            return { pushToken: e.pushToken, title: notif.title, body: notif.body, data: { salonId, entryId: e.id } };
          }));
        }
      }
      if (prevQueueLen.current !== null && entries.length === 0 && prevQueueLen.current > 0) {
        try {
          const latestSalon = await getSalon(salonId);
          if (latestSalon?.stylists) {
            const reset = latestSalon.stylists.map((st) => ({ ...st, status: "available" }));
            await saveSalon(salonId, { stylists: reset, queueCount: 0, avgWaitMin: 0 });
          }
        } catch (e) { console.error(e); }
      }
      prevQueueLen.current = entries.length;
    });
  }, [salonId, salon]);

  useEffect(() => {
    if (!salonId) return;
    const q = query(
      collection(firestore, "salons", salonId, "queue"),
      where("status", "==", "done"),
      where("paymentStatus", "!=", "paid"),
      orderBy("paymentStatus"),
      orderBy("completedAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setDoneQueue(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [salonId]);

  const handleGroupConfirm = async (assignments) => {
    const entry = groupPicker;
    setGroupPicker(null);
    if (!entry) return;
    try {
      const updatedMembers = (entry.groupMembers || []).map((m) => ({
        ...m,
        stylistId:   assignments[m.id]?.stylistId   || null,
        stylistName: assignments[m.id]?.stylistName || null,
      }));
      await updateDoc(doc(firestore, "salons", salonId, "queue", entry.id), {
        status:       "in-service",
        groupMembers: updatedMembers,
        updatedAt:    serverTimestamp(),
      });
      if (salon?.stylists) {
        const busyIds = Object.values(assignments).map((a) => a.stylistId).filter(Boolean);
        const updated = salon.stylists.map((st) =>
          busyIds.includes(st.id) ? { ...st, status: "busy" } : st
        );
        await saveSalon(salonId, { stylists: updated });
      }
    } catch (err) {
      crossAlert("Error", err.message);
    }
  };

  const handleStylistSelected = async (stylist) => {
    const entry = stylistPicker;
    setStylistPicker(null);
    if (!entry) return;
    try {
      // If staff skipped, auto-assign first available stylist
      let assignedStylist = stylist;
      if (!assignedStylist) {
        assignedStylist = (salon?.stylists || []).find(
          (st) => st.status === "available"
        ) || null;
      }
      const stylistId = assignedStylist?.id || null;

      await updateQueueEntry(salonId, entry.id, {
        status:      "in-service",
        stylistId:   stylistId,
        stylistName: assignedStylist?.name || null,
      });
      if (stylistId && salon?.stylists) {
        const updated = salon.stylists.map((st) =>
          st.id === stylistId ? { ...st, status: "busy" } : st
        );
        await saveSalon(salonId, { stylists: updated });
      }
    } catch (err) { crossAlert("Error", err.message); }
  };

  const handleAction = async (action, entry) => {
    try {
      switch (action) {
        case "call":
          await updateQueueEntry(salonId, entry.id, { status: "called", calledAt: serverTimestamp() });
          if (entry.pushToken) {
            const notif = NOTIFICATIONS.called(salon?.name || "the salon");
            await sendPushNotification(entry.pushToken, notif.title, notif.body, { salonId, entryId: entry.id });
          }
          break;

        case "start":
          if (entry.isGroupBooking && (entry.groupMembers || []).length > 1) {
            setGroupPicker(entry);
          } else if (entry.stylistId) {
            await updateQueueEntry(salonId, entry.id, { status: "in-service" });
            if (salon?.stylists) {
              const updated = salon.stylists.map((st) =>
                st.id === entry.stylistId ? { ...st, status: "busy" } : st
              );
              await saveSalon(salonId, { stylists: updated });
            }
          } else {
            setStylistPicker(entry);
          }
          break;

        case "done": {
          await completeService(salonId, entry.id, entry.stylistId);
          await updateQueueEntry(salonId, entry.id, { paymentStatus: "pending" });
          if (salon?.stylists) {
            const busyIds = entry.isGroupBooking
              ? (entry.groupMembers || []).map((m) => m.stylistId).filter(Boolean)
              : [entry.stylistId].filter(Boolean);
            const updated = salon.stylists.map((st) =>
              busyIds.includes(st.id) ? { ...st, status: "available" } : st
            );
            await saveSalon(salonId, { stylists: updated });
          }
          await recalculateQueue(salonId, availableStylists);

          // Alert next waiting customer early if their updated wait is <= 5 min
          const nextCustomer = queue
            .filter((e) => e.status === "waiting")
            .sort((a, b) => a.position - b.position)[0];
          if (nextCustomer?.pushToken && (nextCustomer?.estimatedWaitMin ?? 99) <= 5) {
            const notif = NOTIFICATIONS.readyEarly(salon?.name || "the salon");
            await sendPushNotification(
              nextCustomer.pushToken,
              notif.title,
              notif.body,
              { salonId, entryId: nextCustomer.id }
            );
          }

          setPaymentEntry({ ...entry, status: "done", paymentStatus: "pending" });
          break;
        }

        case "no-show":
          crossAlert(
            "Mark as no-show?",
            `${entry.customerName} will be removed from the queue.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, remove", style: "destructive",
                onPress: async () => {
                  try {
                    await updateQueueEntry(salonId, entry.id, { status: "no-show" });
                    await recalculateQueue(salonId, availableStylists);
                  } catch (e) { crossAlert("Error", e.message); }
                },
              },
            ]
          );
          break;

        case "collect-payment":
          setPaymentEntry(entry);
          break;
      }
    } catch (err) {
      crossAlert("Error", err.message);
    }
  };

  const waiting   = queue.filter((e) => e.status === "waiting").length;
  const inService = queue.filter((e) => e.status !== "waiting").length;
  const avgWait   = waiting > 0
    ? Math.round(queue.filter((e) => e.status === "waiting").reduce((s, e) => s + (e.estimatedWaitMin || 0), 0) / waiting)
    : 0;

  const allEntries = [
    ...queue,
    ...doneQueue.filter((d) => !queue.find((q) => q.id === d.id)),
  ];

  return (
    <View style={s.container}>
      <View style={s.stats}>
        <Stat label="Waiting"    value={waiting}       color="#F59E0B" />
        <Stat label="In Service" value={inService}      color="#3B82F6" />
        <Stat label="Avg Wait"   value={`${avgWait}m`} color="#6b7280" />
        {doneQueue.length > 0 && (
          <Stat label="Unpaid" value={doneQueue.length} color="#8B5CF6" />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1a1a2e" size="large" />
      ) : (
        <FlatList
          data={allEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const isPending = item.status === "done" && item.paymentStatus !== "paid";
            const isGroup   = item.isGroupBooking && (item.groupMembers || []).length > 1;
            const color     = isPending ? "#8B5CF6" : (STATUS_COLORS[item.status] || "#9ca3af");
            const assignedStylist = (salon?.stylists || []).find((st) => st.id === item.stylistId);

            return (
              <View style={[
                s.card,
                item.status === "called" && { borderColor: "#10B981", borderWidth: 2 },
                isPending && { borderColor: "#8B5CF6", borderWidth: 1.5 },
                isGroup && { borderColor: "#6366f1", borderWidth: 1.5 },
              ]}>
                <View style={s.cardLeft}>
                  <View style={[s.pos, { backgroundColor: color + "22" }]}>
                    {isPending
                      ? <Text style={{ fontSize: 18 }}>💳</Text>
                      : <Text style={[s.posText, { color }]}>#{item.position}</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                      <Text style={s.customerName} numberOfLines={1}>{item.customerName}</Text>
                      {item.type === "walk-in" && (
                        <View style={s.badge}><Text style={s.badgeText}>Walk-in</Text></View>
                      )}
                      {isGroup && (
                        <View style={[s.badge, { backgroundColor: "#eef2ff" }]}>
                          <Text style={[s.badgeText, { color: "#6366f1" }]}>👨‍👩‍👧 {item.peopleCount}</Text>
                        </View>
                      )}
                    </View>

                    {/* Group: show per-person services */}
                    {isGroup && item.status === "in-service" ? (
                      <View style={s.groupMembersRow}>
                        {(item.groupMembers || []).map((m, i) => (
                          <Text key={i} style={s.groupMemberChip}>
                            {m.name}: {m.stylistName || "any"}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <>
                        <Text style={s.services} numberOfLines={1}>
                          {(item.services || []).map((sv) => sv.name).join(", ")}
                        </Text>
                        <View style={s.metaRow}>
                          {!isPending && item.status === "waiting" && (
                            <Text style={s.waitText}>⏱ {formatWait(item.estimatedWaitMin)}</Text>
                          )}
                          {isPending && (
                            <Text style={[s.waitText, { color: "#8B5CF6" }]}>💳 Payment pending</Text>
                          )}
                          {item.totalPrice > 0 && (
                            <Text style={s.priceText}>{formatPrice(item.totalPrice)}</Text>
                          )}
                          {assignedStylist && !isGroup && (
                            <Text style={s.stylistTag}>💇 {assignedStylist.name}</Text>
                          )}
                          {item.status === "in-service" && !isGroup && (
                            <Text style={s.inServiceText}>✂️ In service</Text>
                          )}
                          {item.status === "called" && (
                            <Text style={s.calledText}>📣 Called</Text>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <View style={s.cardRight}>
                  {item.status === "waiting" && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#1a1a2e" }]} onPress={() => handleAction("call", item)}>
                      <Text style={s.actionBtnText}>Call →</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "waiting" && item.pushToken && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: "#f59e0b" }]}
                      onPress={async () => {
                        const notif = NOTIFICATIONS.readyEarly(salon?.name || "the salon");
                        await sendPushNotification(item.pushToken, notif.title, notif.body, {
                          salonId, entryId: item.id,
                        });
                        crossAlert("Alerted", `${item.customerName} has been notified to head over.`);
                      }}
                    >
                      <Text style={s.actionBtnText}>⚡ Alert</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "called" && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#3B82F6" }]} onPress={() => handleAction("start", item)}>
                      <Text style={s.actionBtnText}>{isGroup ? "Assign 💇" : "Start ✂️"}</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "in-service" && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#16a34a" }]} onPress={() => handleAction("done", item)}>
                      <Text style={s.actionBtnText}>Done ✅</Text>
                    </TouchableOpacity>
                  )}
                  {isPending && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#8B5CF6" }]} onPress={() => handleAction("collect-payment", item)}>
                      <Text style={s.actionBtnText}>💳 Pay</Text>
                    </TouchableOpacity>
                  )}
                  {!isPending && item.status !== "done" && (
                    <TouchableOpacity style={s.noShowBtn} onPress={() => handleAction("no-show", item)}>
                      <Text style={s.noShowText}>No-show</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🎉</Text>
              <Text style={s.emptyText}>Queue is empty!</Text>
              <Text style={s.emptySub}>All stylists reset to available.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowWalkIn(true)}>
        <Text style={s.fabText}>+ Walk-in</Text>
      </TouchableOpacity>

      <WalkInModal visible={showWalkIn} onClose={() => setShowWalkIn(false)} salon={salon} salonId={salonId} />

      <GroupStylistModal
        visible={!!groupPicker}
        onClose={() => setGroupPicker(null)}
        onConfirm={handleGroupConfirm}
        entry={groupPicker}
        stylists={salon?.stylists}
      />

      <StylistPickerModal
        visible={!!stylistPicker}
        onClose={() => setStylistPicker(null)}
        onSelect={handleStylistSelected}
        stylists={salon?.stylists}
        entryName={stylistPicker?.customerName || ""}
      />

      <PaymentScreen
        visible={!!paymentEntry}
        onClose={(confirmed) => {
          setPaymentEntry(null);
          if (confirmed) crossAlert("Payment confirmed! ✅", "The customer has been notified.");
        }}
        entry={paymentEntry}
        salonId={salonId}
        salonName={salon?.name}
      />
    </View>
  );
}

const Stat = ({ label, value, color }) => (
  <View style={s.stat}>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  stats:            { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", justifyContent: "space-around" },
  stat:             { alignItems: "center" },
  statValue:        { fontSize: 24, fontWeight: "900" },
  statLabel:        { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  list:             { padding: 14, gap: 10, paddingBottom: 100 },
  card:             { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  cardLeft:         { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pos:              { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  posText:          { fontSize: 14, fontWeight: "900" },
  nameRow:          { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  customerName:     { fontSize: 15, fontWeight: "700", color: "#1a1a2e", maxWidth: 130 },
  badge:            { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:        { fontSize: 10, color: "#1d4ed8", fontWeight: "600" },
  services:         { fontSize: 12, color: "#6b7280", marginTop: 2 },
  metaRow:          { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  groupMembersRow:  { marginTop: 6, gap: 3 },
  groupMemberChip:  { fontSize: 11, color: "#6366f1", fontWeight: "600" },
  waitText:         { fontSize: 11, color: "#d97706", fontWeight: "600" },
  priceText:        { fontSize: 11, color: "#16a34a", fontWeight: "600" },
  stylistTag:       { fontSize: 11, color: "#6b7280" },
  inServiceText:    { fontSize: 11, color: "#3B82F6", fontWeight: "600" },
  calledText:       { fontSize: 11, color: "#10B981", fontWeight: "600" },
  cardRight:        { alignItems: "flex-end", gap: 8, marginLeft: 8 },
  actionBtn:        { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText:    { color: "#fff", fontSize: 13, fontWeight: "700" },
  noShowBtn:        { paddingHorizontal: 8, paddingVertical: 4 },
  noShowText:       { fontSize: 11, color: "#ef4444" },
  fab:              { position: "absolute", bottom: 24, right: 20, backgroundColor: "#1a1a2e", borderRadius: 20, paddingVertical: 14, paddingHorizontal: 22, elevation: 6 },
  fabText:          { color: "#fff", fontSize: 15, fontWeight: "800" },
  empty:            { alignItems: "center", marginTop: 80, gap: 8 },
  emptyEmoji:       { fontSize: 48 },
  emptyText:        { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:         { fontSize: 13, color: "#9ca3af" },
});
