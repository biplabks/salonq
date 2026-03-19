// apps/salon/src/screens/QueueDashboard.js
// Added payment collection flow after service is done.

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Modal, TextInput, ActivityIndicator,
} from "react-native";
import {
  subscribeToQueue, updateQueueEntry, completeService,
  saveSalon, getSalon,
  serverTimestamp, addDoc, collection, firestore,
} from "../firebase";
import { getDocs, query, where, onSnapshot } from "firebase/firestore";
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

const formatWait = (min) => {
  if (!min || min <= 0) return "Now";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
};

// ── Stylist Picker Modal ───────────────────────────────────────────────────────
function StylistPickerModal({ visible, onClose, onSelect, stylists, entryName }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={sp.container}>
        <View style={sp.header}>
          <Text style={sp.title}>Assign Stylist</Text>
          <TouchableOpacity onPress={onClose}><Text style={sp.close}>✕</Text></TouchableOpacity>
        </View>
        <Text style={sp.sub}>Who is serving {entryName}?</Text>
        {(stylists || []).filter((s) => s.status !== "off").map((stylist) => (
          <TouchableOpacity key={stylist.id} style={sp.stylistRow} onPress={() => onSelect(stylist)}>
            <View style={sp.avatar}><Text style={{ fontSize: 22 }}>💇</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={sp.stylistName}>{stylist.name}</Text>
              <Text style={sp.stylistStatus}>
                {stylist.status === "available" ? "✅ Available" :
                 stylist.status === "busy"      ? "⏳ Busy"      : "☕ On break"}
              </Text>
            </View>
            <Text style={sp.arrow}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={sp.skipBtn} onPress={() => onSelect(null)}>
          <Text style={sp.skipText}>Skip — start without assigning</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

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
      const queueRef   = collection(firestore, "salons", salonId, "queue");
      const activeSnap = await getDocs(
        query(queueRef, where("status", "in", ["waiting", "called", "in-service"]))
      );
      const nextPosition  = activeSnap.size + 1;
      const totalDuration = selected.reduce((s, sv) => s + (sv.durationMin || 30), 0);
      await addDoc(queueRef, {
        customerId: null, customerName: name, services: selected,
        stylistId: null, status: "waiting", type: "walk-in",
        position: nextPosition, estimatedWaitMin: (nextPosition - 1) * totalDuration,
        pushToken: null, paymentStatus: "pending",
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

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function QueueDashboard({ salonId, salon }) {
  const [queue,         setQueue]         = useState([]);
  const [doneQueue,     setDoneQueue]     = useState([]); // payment pending entries
  const [loading,       setLoading]       = useState(true);
  const [showWalkIn,    setShowWalkIn]    = useState(false);
  const [stylistPicker, setStylistPicker] = useState(null);
  const [paymentEntry,  setPaymentEntry]  = useState(null);
  const prevQueueLen = useRef(null);

  const availableStylists = (salon?.stylists || []).filter(
    (s) => s.status === "available" || s.status === "busy"
  ).length || 1;

  // Subscribe to active queue
  useEffect(() => {
    if (!salonId) return;
    return subscribeToQueue(salonId, async (entries) => {
      const prevQueue = queue;
      setQueue(entries);
      setLoading(false);

      // Notify position changes
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

      // Reset stylists when queue empties
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

  // Subscribe to payment-pending entries (done but not paid)
  // No orderBy to avoid composite index requirement — sort client-side
  useEffect(() => {
    if (!salonId) return;
    const q = query(
      collection(firestore, "salons", salonId, "queue"),
      where("status", "==", "done"),
      where("paymentStatus", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.completedAt?.seconds ?? 0;
          const bTime = b.completedAt?.seconds ?? 0;
          return bTime - aTime;
        });
      setDoneQueue(entries);
    });
  }, [salonId]);

  const handleStylistSelected = async (stylist) => {
    const entry = stylistPicker;
    setStylistPicker(null);
    if (!entry) return;
    try {
      await updateQueueEntry(salonId, entry.id, { status: "in-service", stylistId: stylist?.id || null });
      if (stylist?.id && salon?.stylists) {
        const updated = salon.stylists.map((st) => st.id === stylist.id ? { ...st, status: "busy" } : st);
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
          if (entry.stylistId) {
            await updateQueueEntry(salonId, entry.id, { status: "in-service" });
            if (salon?.stylists) {
              const updated = salon.stylists.map((st) => st.id === entry.stylistId ? { ...st, status: "busy" } : st);
              await saveSalon(salonId, { stylists: updated });
            }
          } else {
            setStylistPicker(entry);
          }
          break;

        case "done": {
          await completeService(salonId, entry.id, entry.stylistId);
          // Mark as payment pending
          await updateQueueEntry(salonId, entry.id, { paymentStatus: "pending" });
          if (entry.stylistId && salon?.stylists) {
            const updated = salon.stylists.map((st) => st.id === entry.stylistId ? { ...st, status: "available" } : st);
            await saveSalon(salonId, { stylists: updated });
          }
          await recalculateQueue(salonId, availableStylists);
          // Open payment screen immediately
          setPaymentEntry({ ...entry, status: "done", paymentStatus: "pending" });
          break;
        }

        case "no-show":
          crossAlert(
            "Mark as no-show?",
            `${entry.customerName} will be removed and the queue will reorder.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, remove",
                style: "destructive",
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

  // Combine active queue + payment pending entries
  const allEntries = [
    ...queue,
    ...doneQueue.filter((d) => !queue.find((q) => q.id === d.id)),
  ];

  return (
    <View style={s.container}>
      <View style={s.stats}>
        <Stat label="Waiting"    value={waiting}       color="#F59E0B" />
        <Stat label="In Service" value={inService}     color="#3B82F6" />
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
            const isPending       = item.status === "done" && item.paymentStatus !== "paid";
            const color           = isPending ? "#8B5CF6" : (STATUS_COLORS[item.status] || "#9ca3af");
            const assignedStylist = (salon?.stylists || []).find((st) => st.id === item.stylistId);

            return (
              <View style={[
                s.card,
                item.status === "called" && { borderColor: "#10B981", borderWidth: 2 },
                isPending && { borderColor: "#8B5CF6", borderWidth: 1.5 },
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
                      <Text style={s.customerName}>{item.customerName}</Text>
                      {item.type === "walk-in" && (
                        <View style={s.walkInBadge}><Text style={s.walkInText}>Walk-in</Text></View>
                      )}
                      {item.pushToken && <Text style={s.notifIcon}>🔔</Text>}
                    </View>
                    <Text style={s.services} numberOfLines={1}>
                      {(item.services || []).map((sv) => sv.name).join(", ")}
                    </Text>
                    <View style={s.metaRow}>
                      {!isPending && <Text style={s.waitText}>⏱ {formatWait(item.estimatedWaitMin)}</Text>}
                      {isPending  && <Text style={[s.waitText, { color: "#8B5CF6" }]}>💳 Payment pending</Text>}
                      {assignedStylist && <Text style={s.stylistTag}>💇 {assignedStylist.name}</Text>}
                      {item.status === "in-service" && <Text style={s.inServiceText}>✂️ In service</Text>}
                      {item.status === "called"     && <Text style={s.calledText}>📣 Called</Text>}
                    </View>
                  </View>
                </View>

                <View style={s.cardRight}>
                  {item.status === "waiting" && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#1a1a2e" }]} onPress={() => handleAction("call", item)}>
                      <Text style={s.actionBtnText}>Call →</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "called" && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#3B82F6" }]} onPress={() => handleAction("start", item)}>
                      <Text style={s.actionBtnText}>Start ✂️</Text>
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
  container:     { flex: 1, backgroundColor: "#fafafa" },
  stats:         { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", justifyContent: "space-around" },
  stat:          { alignItems: "center" },
  statValue:     { fontSize: 24, fontWeight: "900" },
  statLabel:     { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  list:          { padding: 14, gap: 10, paddingBottom: 100 },
  card:          { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  cardLeft:      { flex: 1, flexDirection: "row", gap: 12, alignItems: "center" },
  pos:           { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  posText:       { fontSize: 14, fontWeight: "900" },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  customerName:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  walkInBadge:   { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  walkInText:    { fontSize: 10, color: "#1d4ed8", fontWeight: "600" },
  notifIcon:     { fontSize: 12 },
  services:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  metaRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  waitText:      { fontSize: 11, color: "#d97706", fontWeight: "600" },
  stylistTag:    { fontSize: 11, color: "#6b7280" },
  inServiceText: { fontSize: 11, color: "#3B82F6", fontWeight: "600" },
  calledText:    { fontSize: 11, color: "#10B981", fontWeight: "600" },
  cardRight:     { alignItems: "flex-end", gap: 8, marginLeft: 8 },
  actionBtn:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  noShowBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  noShowText:    { fontSize: 11, color: "#ef4444" },
  fab:           { position: "absolute", bottom: 24, right: 20, backgroundColor: "#1a1a2e", borderRadius: 20, paddingVertical: 14, paddingHorizontal: 22, elevation: 6 },
  fabText:       { color: "#fff", fontSize: 15, fontWeight: "800" },
  empty:         { alignItems: "center", marginTop: 80, gap: 8 },
  emptyEmoji:    { fontSize: 48 },
  emptyText:     { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:      { fontSize: 13, color: "#9ca3af" },
});

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

const sp = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fafafa", padding: 20 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title:        { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  close:        { fontSize: 20, color: "#6b7280" },
  sub:          { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  stylistRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", gap: 12 },
  avatar:       { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistName:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistStatus:{ fontSize: 12, color: "#6b7280", marginTop: 2 },
  arrow:        { fontSize: 22, color: "#9ca3af" },
  skipBtn:      { alignItems: "center", paddingVertical: 16 },
  skipText:     { fontSize: 14, color: "#9ca3af" },
});
