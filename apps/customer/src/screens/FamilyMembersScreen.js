// apps/customer/src/screens/FamilyMembersScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ScrollView, Modal, ActivityIndicator, Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getCustomer, saveCustomer } from "../firebase";

const RELATIONSHIPS = [
  "Spouse", "Child", "Parent", "Sibling",
  "Grandparent", "Grandchild", "Friend", "Other",
];

const generateId = () => `fm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export default function FamilyMembersScreen({ navigation }) {
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);

  // Form
  const [name,         setName]         = useState("");
  const [relationship, setRelationship] = useState("Child");

  const user = getAuth().currentUser;

  useEffect(() => {
    if (user) {
      getCustomer(user.uid).then((c) => {
        setMembers(c?.familyMembers || []);
        setLoading(false);
      });
    }
  }, []);

  const openAdd = () => {
    setEditing(null);
    setName(""); setRelationship("Child");
    setShowModal(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setName(member.name);
    setRelationship(member.relationship || "Child");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Please enter a name"); return; }
    setSaving(true);
    try {
      let updated;
      if (editing) {
        updated = members.map((m) =>
          m.id === editing.id ? { ...m, name: name.trim(), relationship } : m
        );
      } else {
        updated = [...members, { id: generateId(), name: name.trim(), relationship }];
      }
      await saveCustomer(user.uid, { familyMembers: updated });
      setMembers(updated);
      setShowModal(false);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (member) => {
    Alert.alert(
      "Remove family member?",
      `Remove ${member.name} from your family list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updated = members.filter((m) => m.id !== member.id);
            await saveCustomer(user.uid, { familyMembers: updated });
            setMembers(updated);
          },
        },
      ]
    );
  };

  const RELATIONSHIP_EMOJI = {
    Spouse:      "💑", Child:       "👶", Parent:      "👨‍👩‍👦",
    Sibling:     "👫", Grandparent: "👴", Grandchild:  "🧒",
    Friend:      "👥", Other:       "👤",
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#1a1a2e" /></View>;
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Family Members</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {members.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={s.emptyTitle}>No family members yet</Text>
            <Text style={s.emptySub}>
              Add family members so you can check them in at salons without them needing an account.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
              <Text style={s.emptyBtnText}>+ Add Family Member</Text>
            </TouchableOpacity>
          </View>
        )}

        {members.map((member) => (
          <View key={member.id} style={s.card}>
            <View style={s.cardLeft}>
              <View style={s.avatar}>
                <Text style={{ fontSize: 26 }}>
                  {RELATIONSHIP_EMOJI[member.relationship] || "👤"}
                </Text>
              </View>
              <View>
                <Text style={s.memberName}>{member.name}</Text>
                <Text style={s.memberRel}>{member.relationship}</Text>
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(member)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(member)}>
                <Text style={s.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>{editing ? "Edit Member" : "Add Family Member"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
            <Text style={m.label}>Name *</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. Sarah"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={m.label}>Relationship</Text>
            <View style={m.relationshipGrid}>
              {RELATIONSHIPS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[m.relBtn, relationship === rel && m.relBtnSel]}
                  onPress={() => setRelationship(rel)}
                >
                  <Text style={m.relEmoji}>{RELATIONSHIP_EMOJI[rel] || "👤"}</Text>
                  <Text style={[m.relText, relationship === rel && m.relTextSel]}>{rel}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.saveBtnText}>{editing ? "Save Changes" : "Add Member"}</Text>
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
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:         { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:        { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  addBtn:       { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  content:      { padding: 16, gap: 10 },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLeft:     { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:       { width: 50, height: 50, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  memberName:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  memberRel:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardActions:  { flexDirection: "row", gap: 8 },
  editBtn:      { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnText:  { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  deleteBtn:    { backgroundColor: "#fee2e2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  deleteBtnText:{ fontSize: 13, fontWeight: "600", color: "#ef4444" },
  empty:        { alignItems: "center", marginTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyEmoji:   { fontSize: 56 },
  emptyTitle:   { fontSize: 18, fontWeight: "800", color: "#1a1a2e", textAlign: "center" },
  emptySub:     { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  emptyBtn:     { backgroundColor: "#1a1a2e", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const m = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:            { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:            { fontSize: 20, color: "#6b7280" },
  content:          { padding: 20, paddingBottom: 40 },
  label:            { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 8, marginTop: 16 },
  input:            { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a2e" },
  relationshipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  relBtn:           { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff", alignItems: "center", minWidth: "22%" },
  relBtnSel:        { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  relEmoji:         { fontSize: 20, marginBottom: 4 },
  relText:          { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  relTextSel:       { color: "#fff", fontWeight: "600" },
  saveBtn:          { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  saveBtnText:      { color: "#fff", fontSize: 16, fontWeight: "700" },
});
