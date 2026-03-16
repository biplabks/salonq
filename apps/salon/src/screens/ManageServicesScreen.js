// apps/salon/src/screens/ManageServicesScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, Alert, ScrollView, Modal, ActivityIndicator, Platform,
} from "react-native";
import { saveSalon } from "../firebase";

const CATEGORIES = ["Hair", "Colour", "Grooming", "Nails", "Treatment", "Other"];

const generateId = () => `svc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export default function ManageServicesScreen({ salon, salonId, onBack }) {
  const [services,  setServices]  = useState(salon?.services || []);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [loading,   setLoading]   = useState(false);

  // Form fields
  const [name,        setName]        = useState("");
  const [price,       setPrice]       = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [category,    setCategory]    = useState("Hair");

  const openAdd = () => {
    setEditing(null);
    setName(""); setPrice(""); setDurationMin(""); setCategory("Hair");
    setShowModal(true);
  };

  const openEdit = (service) => {
    setEditing(service);
    setName(service.name);
    setPrice(String(service.price));
    setDurationMin(String(service.durationMin));
    setCategory(service.category || "Hair");
    setShowModal(true);
  };

  const handleSave = async () => {
    const warn = (msg) => Platform.OS === "web" ? window.alert(msg) : Alert.alert(msg);
    if (!name.trim())                       { warn("Please enter a service name"); return; }
    if (!price || isNaN(price))             { warn("Please enter a valid price"); return; }
    if (!durationMin || isNaN(durationMin)) { warn("Please enter a valid duration"); return; }

    setLoading(true);
    try {
      let updated;
      if (editing) {
        updated = services.map((s) =>
          s.id === editing.id
            ? { ...s, name: name.trim(), price: Number(price), durationMin: Number(durationMin), category }
            : s
        );
      } else {
        updated = [...services, {
          id:          generateId(),
          name:        name.trim(),
          price:       Number(price),
          durationMin: Number(durationMin),
          category,
        }];
      }
      await saveSalon(salonId, { services: updated });
      setServices(updated);
      setShowModal(false);
    } catch (err) {
      if (Platform.OS === "web") window.alert(`Error: ${err.message}`);
      else Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (service) => {
    const doDelete = async () => {
      try {
        const updated = services.filter((s) => s.id !== service.id);
        await saveSalon(salonId, { services: updated });
        setServices(updated);
      } catch (err) {
        if (Platform.OS === "web") window.alert(`Error: ${err.message}`);
        else Alert.alert("Error", err.message);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Remove "${service.name}" from your services?`)) doDelete();
      return;
    }
    Alert.alert(
      "Delete service?",
      `Remove "${service.name}" from your services?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  };

  // Group services by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = services.filter((s) => (s.category || "Other") === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Services & Pricing</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {services.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💈</Text>
            <Text style={s.emptyText}>No services yet</Text>
            <Text style={s.emptySub}>Tap "+ Add" to add your first service</Text>
          </View>
        )}

        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat}>
            <Text style={s.categoryLabel}>{cat}</Text>
            {items.map((service) => (
              <View key={service.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceName}>{service.name}</Text>
                    <Text style={s.serviceMeta}>{service.durationMin} min</Text>
                  </View>
                  <Text style={s.servicePrice}>৳{service.price}</Text>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(service)}>
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(service)}>
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>{editing ? "Edit Service" : "Add Service"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
            <Text style={m.label}>Service name *</Text>
            <TextInput style={m.input} placeholder="e.g. Haircut & Blow-dry" value={name} onChangeText={setName} />

            <Text style={m.label}>Price (৳) *</Text>
            <TextInput style={m.input} placeholder="e.g. 500" value={price} onChangeText={setPrice} keyboardType="numeric" />

            <Text style={m.label}>Duration (minutes) *</Text>
            <TextInput style={m.input} placeholder="e.g. 45" value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" />

            <Text style={m.label}>Category</Text>
            <View style={m.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[m.catBtn, category === cat && m.catBtnSel]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[m.catText, category === cat && m.catTextSel]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.saveBtnText}>{editing ? "Save Changes" : "Add Service"}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:           { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:          { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  addBtn:         { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  content:        { padding: 16 },
  categoryLabel:  { fontSize: 12, fontWeight: "700", color: "#9ca3af", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  card:           { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTop:        { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  serviceName:    { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  serviceMeta:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  servicePrice:   { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  cardActions:    { flexDirection: "row", gap: 8 },
  editBtn:        { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  editBtnText:    { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  deleteBtn:      { flex: 1, backgroundColor: "#fee2e2", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  deleteBtnText:  { fontSize: 13, fontWeight: "600", color: "#ef4444" },
  empty:          { alignItems: "center", marginTop: 80, gap: 8 },
  emptyEmoji:     { fontSize: 48 },
  emptyText:      { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:       { fontSize: 13, color: "#9ca3af" },
});

const m = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fafafa" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:        { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:        { fontSize: 20, color: "#6b7280" },
  content:      { padding: 20, paddingBottom: 40 },
  label:        { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 8, marginTop: 16 },
  input:        { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a2e" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn:       { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" },
  catBtnSel:    { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  catText:      { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  catTextSel:   { color: "#fff", fontWeight: "600" },
  saveBtn:      { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});
