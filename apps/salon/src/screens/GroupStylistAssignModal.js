// apps/salon/src/screens/GroupStylistAssignModal.js
// Shown when staff clicks "Start" on a group booking
// Allows assigning one stylist per person in the group

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, ScrollView, ActivityIndicator,
} from "react-native";
import { crossAlert } from "../utils/crossAlert";

const RELATIONSHIP_EMOJI = {
  Spouse: "💑", Child: "👶", Parent: "👨‍👩‍👦",
  Sibling: "👫", Grandparent: "👴", Grandchild: "🧒",
  Friend: "👥", Other: "👤", Myself: "😊",
};

export default function GroupStylistAssignModal({
  visible, onClose, onConfirm, entry, stylists,
}) {
  // Build list of people in this booking
  const people = [
    ...(entry?.checkingInSelf !== false ? [{
      id:           "self",
      name:         entry?.customerName?.split(",")[0] || "Customer",
      relationship: "Myself",
    }] : []),
    ...(entry?.familyMembers || []),
  ];

  // assignments: { personId -> stylist }
  const [assignments, setAssignments]   = useState({});
  const [submitting,  setSubmitting]    = useState(false);

  const availableStylists = (stylists || []).filter((s) => s.status !== "off");

  const assign = (personId, stylist) => {
    setAssignments((prev) => ({ ...prev, [personId]: stylist }));
  };

  const getAssignedStylist = (personId) => assignments[personId] || null;

  // Check if a stylist is already assigned to someone else
  const isStylistTaken = (stylistId, currentPersonId) =>
    Object.entries(assignments).some(
      ([pid, st]) => pid !== currentPersonId && st?.id === stylistId
    );

  const assignedCount  = Object.keys(assignments).length;
  const allAssigned    = assignedCount === people.length;

  const handleConfirm = async () => {
    if (!allAssigned) {
      crossAlert(
        "Assign all stylists",
        `Please assign a stylist to all ${people.length} people.`
      );
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(assignments);
    } catch (err) {
      crossAlert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!entry) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Assign Stylists</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.subtitle}>
          👨‍👩‍👧 Group of {people.length} — assign one stylist per person
        </Text>

        <ScrollView contentContainerStyle={s.content}>
          {people.map((person) => {
            const assigned = getAssignedStylist(person.id);
            return (
              <View key={person.id} style={s.personCard}>
                {/* Person info */}
                <View style={s.personHeader}>
                  <View style={s.personAvatar}>
                    <Text style={{ fontSize: 22 }}>
                      {RELATIONSHIP_EMOJI[person.relationship] || "👤"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.personName}>{person.name}</Text>
                    <Text style={s.personRel}>{person.relationship}</Text>
                  </View>
                  {assigned && (
                    <View style={s.assignedBadge}>
                      <Text style={s.assignedBadgeText}>✓ {assigned.name}</Text>
                    </View>
                  )}
                </View>

                {/* Stylist selection */}
                <Text style={s.selectLabel}>Select stylist:</Text>
                <View style={s.stylistGrid}>
                  {availableStylists.map((stylist) => {
                    const isAssigned  = assigned?.id === stylist.id;
                    const isTaken     = isStylistTaken(stylist.id, person.id);
                    return (
                      <TouchableOpacity
                        key={stylist.id}
                        style={[
                          s.stylistChip,
                          isAssigned && s.stylistChipSelected,
                          isTaken    && s.stylistChipTaken,
                        ]}
                        onPress={() => !isTaken && assign(person.id, stylist)}
                        disabled={isTaken}
                      >
                        <Text style={[
                          s.stylistChipText,
                          isAssigned && s.stylistChipTextSelected,
                          isTaken    && s.stylistChipTextTaken,
                        ]}>
                          💇 {stylist.name}
                        </Text>
                        {isTaken && (
                          <Text style={s.takenLabel}>taken</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Summary */}
          <View style={s.summary}>
            <Text style={s.summaryText}>
              {assignedCount}/{people.length} stylists assigned
            </Text>
            {allAssigned && (
              <Text style={s.summaryReady}>✅ Ready to start!</Text>
            )}
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[s.confirmBtn, !allAssigned && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={submitting || !allAssigned}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.confirmBtnText}>
                  Start Service for {people.length} People ✂️
                </Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:              { flex: 1, backgroundColor: "#fafafa" },
  header:                 { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:                  { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:                  { fontSize: 20, color: "#6b7280" },
  subtitle:               { fontSize: 14, color: "#6b7280", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#f9fafb" },
  content:                { padding: 16, gap: 12, paddingBottom: 40 },
  personCard:             { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  personHeader:           { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  personAvatar:           { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  personName:             { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  personRel:              { fontSize: 12, color: "#6b7280", marginTop: 2 },
  assignedBadge:          { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  assignedBadgeText:      { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  selectLabel:            { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 8 },
  stylistGrid:            { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stylistChip:            { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: "#e5e7eb" },
  stylistChipSelected:    { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stylistChipTaken:       { backgroundColor: "#f9fafb", borderColor: "#f3f4f6", opacity: 0.5 },
  stylistChipText:        { fontSize: 13, color: "#374151", fontWeight: "500" },
  stylistChipTextSelected:{ color: "#fff", fontWeight: "700" },
  stylistChipTextTaken:   { color: "#9ca3af" },
  takenLabel:             { fontSize: 10, color: "#9ca3af", marginTop: 2 },
  summary:                { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  summaryText:            { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  summaryReady:           { fontSize: 13, color: "#16a34a", fontWeight: "700" },
  confirmBtn:             { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  confirmBtnText:         { color: "#fff", fontSize: 15, fontWeight: "800" },
});
