// apps/salon/src/screens/ManageStylistsScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ScrollView, Modal, ActivityIndicator,
} from "react-native";
import { saveSalon } from "../firebase";
import { crossAlert, crossAlertInfo } from "../utils/crossAlert";

const AVAILABLE_SKILLS = [
  "Haircut", "Haircut & Blow-dry", "Hair Colour",
  "Beard Trim", "Head Massage", "Manicure",
  "Pedicure", "Hair Treatment", "Styling",
];

const generateId = () => `st_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export default function ManageStylistsScreen({ salon, salonId, onBack }) {
  const [stylists, setStylists]   = useState(salon?.stylists || []);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null); // null = adding new
  const [loading,   setLoading]   = useState(false);

  // Form state
  const [name,   setName]   = useState("");
  const [skills, setSkills] = useState([]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setSkills([]);
    setShowModal(true);
  };

  const openEdit = (stylist) => {
    setEditing(stylist);
    setName(stylist.name);
    setSkills(stylist.skills || []);
    setShowModal(true);
  };

  const toggleSkill = (skill) =>
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );

  const handleSave = async () => {
    if (!name.trim()) {
      crossAlertInfo("Validation", "Please enter a name.");
      return;
    }
    if (!skills.length) {
      crossAlertInfo("Validation", "Please select at least one skill.");
      return;
    }

    setLoading(true);
    try {
      let updated;
      if (editing) {
        updated = stylists.map((s) =>
          s.id === editing.id ? { ...s, name: name.trim(), skills } : s
        );
      } else {
        const newStylist = {
          id:     generateId(),
          name:   name.trim(),
          skills,
          photo:  "",
          status: "available",
        };
        updated = [...stylists, newStylist];
      }
      await saveSalon(salonId, { stylists: updated });
      setStylists(updated);
      setShowModal(false);
    } catch (err) {
      crossAlertInfo("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (stylist) => {
    const doDelete = async () => {
      const updated = stylists.filter((s) => s.id !== stylist.id);
      try {
        await saveSalon(salonId, { stylists: updated });
        setStylists(updated);
      } catch (err) {
        crossAlertInfo("Error", err.message);
      }
    };
    crossAlert("Delete stylist?", `Remove ${stylist.name} from your team?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Manage Stylists</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {stylists.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💇</Text>
            <Text style={s.emptyText}>No stylists yet</Text>
            <Text style={s.emptySub}>Tap "+ Add" to add your first stylist</Text>
          </View>
        )}

        {stylists.map((stylist) => (
          <View key={stylist.id} style={s.card}>
            <View style={s.cardLeft}>
              <View style={s.avatar}>
                <Text style={{ fontSize: 22 }}>💇</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stylistName}>{stylist.name}</Text>
                <Text style={s.skills} numberOfLines={2}>
                  {(stylist.skills || []).join(" · ")}
                </Text>
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(stylist)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(stylist)}>
                <Text style={s.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>{editing ? "Edit Stylist" : "Add Stylist"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
            <Text style={m.label}>Name *</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. Rina Akter"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={m.label}>Skills * (select all that apply)</Text>
            <View style={m.skillsGrid}>
              {AVAILABLE_SKILLS.map((skill) => {
                const selected = skills.includes(skill);
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[m.skillBtn, selected && m.skillBtnSel]}
                    onPress={() => toggleSkill(skill)}
                  >
                    <Text style={[m.skillText, selected && m.skillTextSel]}>
                      {selected ? "✓ " : ""}{skill}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.saveBtnText}>
                    {editing ? "Save Changes" : "Add Stylist"}
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fafafa" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:         { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:        { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  addBtn:       { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  content:      { padding: 16, gap: 10 },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  cardLeft:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar:       { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistName:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  skills:       { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardActions:  { flexDirection: "row", gap: 8 },
  editBtn:      { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  editBtnText:  { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  deleteBtn:    { flex: 1, backgroundColor: "#fee2e2", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  deleteBtnText:{ fontSize: 13, fontWeight: "600", color: "#ef4444" },
  empty:        { alignItems: "center", marginTop: 80, gap: 8 },
  emptyEmoji:   { fontSize: 48 },
  emptyText:    { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:     { fontSize: 13, color: "#9ca3af" },
});

const m = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fafafa" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:        { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:        { fontSize: 20, color: "#6b7280" },
  content:      { padding: 20, paddingBottom: 40 },
  label:        { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 8, marginTop: 16 },
  input:        { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a2e" },
  skillsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillBtn:     { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" },
  skillBtnSel:  { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  skillText:    { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  skillTextSel: { color: "#fff", fontWeight: "600" },
  saveBtn:      { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});