// apps/salon/src/screens/QueueDashboard.js
// The main salon screen — shows live queue, lets staff call next, mark done, add walk-ins.

import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView, Modal,
  TextInput, ActivityIndicator,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  subscribeToQueue,
  callNextCustomer,
  updateQueueEntry,
  completeService,
  addDoc,
  collection,
  db,
  serverTimestamp,
} from "salonq-shared/firebase";
import { formatWait, formatTime, shortName } from "salonq-shared/utils";
import { STATUS_COLORS } from "salonq-shared/models";

// ─── Entry card ───────────────────────────────────────────────────────────────
const QueueCard = ({ entry, salon, onAction }) => {
  const statusColor = STATUS_COLORS[entry.status] || "#9ca3af";
  const services    = (entry.services || []).map((s) => s.name).join(", ");

  return (
    <View style={[c.card, entry.status === "called" && c.cardCalled]}>
      <View style={c.cardLeft}>
        <View style={[c.positionBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[c.positionText, { color: statusColor }]}>#{entry.position}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={c.nameRow}>
            <Text style={c.customerName}>{entry.customerName}</Text>
            {entry.type === "walk-in" && (
              <View style={c.walkInBadge}><Text style={c.walkInText}>Walk-in</Text></View>
            )}
          </View>
          <Text style={c.services} numberOfLines={1}>{services}</Text>
          <Text style={c.joinedAt}>Joined {formatTime(entry.joinedAt)}</Text>
        </View>
      </View>

      <View style={c.cardRight}>
        <Text style={c.wait}>{formatWait(entry.estimatedWaitMin)}</Text>

        {entry.status === "waiting" && (
          <TouchableOpacity style={[c.actionBtn, c.callBtn]} onPress={() => onAction("call", entry)}>
            <Text style={c.actionBtnText}>Call →</Text>
          </TouchableOpacity>
        )}

        {entry.status === "called" && (
          <TouchableOpacity style={[c.actionBtn, c.startBtn]} onPress={() => onAction("start", entry)}>
            <Text style={c.actionBtnText}>Start ✂️</Text>
          </TouchableOpacity>
        )}

        {entry.status === "in-service" && (
          <TouchableOpacity style={[c.actionBtn, c.doneBtn]} onPress={() => onAction("done", entry)}>
            <Text style={c.actionBtnText}>Done ✅</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => onAction("no-show", entry)} style={c.noShowBtn}>
          <Text style={c.noShowText}>No-show</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Walk-in modal ────────────────────────────────────────────────────────────
const WalkInModal = ({ visible, onClose, salon, salonId }) => {
  const [name,     setName]     = useState("");
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = (service) =>
    setSelected((prev) =>
      prev.find((s) => s.id === service.id) ? prev.filter((s) => s.id !== service.id) : [...prev, service]
    );

  const handleAdd = async () => {
    if (!name || !selected.length) {
      Alert.alert("Missing info", "Please enter a name and select at least one service.");
      return;
    }
    setLoading(true);
    try {
      const queueRef = collection(db, "salons", salonId, "queue");
      await addDoc(queueRef, {
        customerId:   null,
        customerName: name,
        services:     selected,
        stylistId:    null,
        status:       "waiting",
        type:         "walk-in",
        position:     999, // will be sorted; ideally call a cloud function to assign correct position
        estimatedWaitMin: selected.reduce((s, sv) => s + sv.durationMin, 0),
        joinedAt:     serverTimestamp(),
        calledAt:     null,
        completedAt:  null,
      });
      setName("");
      setSelected([]);
      onClose();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>Add Walk-in</Text>
          <TouchableOpacity onPress={onClose}><Text style={modal.close}>✕</Text></TouchableOpacity>
        </View>

        <TextInput
          style={modal.input}
          placeholder="Customer name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={modal.label}>Services</Text>
        {(salon?.services || []).map((s) => {
          const sel = !!selected.find((sv) => sv.id === s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={[modal.serviceRow, sel && modal.serviceRowSel]}
              onPress={() => toggle(s)}
            >
              <Text style={[modal.serviceName, sel && { color: "#fff" }]}>{s.name}</Text>
              {sel && <Text style={{ color: "#fff" }}>✓</Text>}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={modal.addBtn} onPress={handleAdd} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={modal.addBtnText}>Add to Queue</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function QueueDashboard({ salonId, salon }) {
  const [queue,     setQueue]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeToQueue(salonId, (entries) => {
      setQueue(entries);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  const handleAction = async (action, entry) => {
    try {
      switch (action) {
        case "call":
          await updateQueueEntry(salonId, entry.id, { status: "called", calledAt: serverTimestamp() });
          break;
        case "start":
          await updateQueueEntry(salonId, entry.id, { status: "in-service" });
          break;
        case "done":
          await completeService(salonId, entry.id, entry.stylistId);
          break;
        case "no-show":
          Alert.alert("Mark as no-show?", `${entry.customerName} will be removed from the queue.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Yes", style: "destructive", onPress: () =>
                updateQueueEntry(salonId, entry.id, { status: "no-show" })
            },
          ]);
          break;
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const waiting   = queue.filter((e) => e.status === "waiting").length;
  const inService = queue.filter((e) => e.status === "in-service" || e.status === "called").length;

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Stat label="Waiting"    value={waiting}   color="#F59E0B" />
        <Stat label="In service" value={inService}  color="#3B82F6" />
        <Stat label="Total today" value={queue.length} color="#6b7280" />
      </View>

      {/* Queue list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1a1a2e" size="large" />
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QueueCard entry={item} salon={salon} onAction={handleAction} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyText}>Queue is empty!</Text>
            </View>
          }
        />
      )}

      {/* Add walk-in FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Walk-in</Text>
      </TouchableOpacity>

      <WalkInModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        salon={salon}
        salonId={salonId}
      />
    </View>
  );
}

const Stat = ({ label, value, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  statsBar:  { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", justifyContent: "space-around" },
  stat:      { alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "900" },
  statLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2, fontWeight: "600" },
  list:      { padding: 14, gap: 10, paddingBottom: 100 },
  empty:     { alignItems: "center", marginTop: 80 },
  emptyEmoji:{ fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#6b7280" },
  fab: {
    position: "absolute",
    bottom: 24, right: 20,
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardCalled: { borderColor: "#10B981", borderWidth: 2 },
  cardLeft:   { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  positionBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  positionText:  { fontSize: 14, fontWeight: "900" },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  customerName:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  walkInBadge:   { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  walkInText:    { fontSize: 10, color: "#1d4ed8", fontWeight: "600" },
  services:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  joinedAt:      { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  cardRight:     { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  wait:          { fontSize: 12, color: "#d97706", fontWeight: "700" },
  actionBtn:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  callBtn:       { backgroundColor: "#1a1a2e" },
  startBtn:      { backgroundColor: "#3B82F6" },
  doneBtn:       { backgroundColor: "#16a34a" },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  noShowBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  noShowText:    { fontSize: 11, color: "#ef4444" },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 20 },
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title:     { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  close:     { fontSize: 20, color: "#6b7280" },
  input:     { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20 },
  label:     { fontSize: 14, fontWeight: "700", color: "#6b7280", marginBottom: 10 },
  serviceRow:{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  serviceRowSel: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  serviceName:   { fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  addBtn:    { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  addBtnText:{ color: "#fff", fontSize: 16, fontWeight: "700" },
});
