// apps/salon/src/screens/ManagePromoCodesScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ScrollView, Modal, ActivityIndicator, Switch,
} from "react-native";
import { saveSalon } from "../firebase";
import { crossAlert } from "../utils/crossAlert";

const generateId = () => `promo_${Date.now()}`;

const EMPTY_FORM = {
  code:            "",
  discountPercent: "",
  description:     "",
  maxUses:         "",         // "" = unlimited
  expiryDate:      "",         // "" = no expiry (YYYY-MM-DD)
  onePerCustomer:  true,
  minSpend:        "",         // "" = no minimum
};

export default function ManagePromoCodesScreen({ salon, salonId, onBack }) {
  const [promos,    setPromos]    = useState(salon?.promoCodes || []);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      code:            promo.code,
      discountPercent: String(promo.discountPercent),
      description:     promo.description || "",
      maxUses:         promo.maxUses     ? String(promo.maxUses) : "",
      expiryDate:      promo.expiryDate  || "",
      onePerCustomer:  promo.onePerCustomer !== false,
      minSpend:        promo.minSpend    ? String(promo.minSpend) : "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim())                                { crossAlert("Missing code",     "Please enter a promo code.");        return; }
    if (!form.discountPercent || isNaN(form.discountPercent)) { crossAlert("Missing discount", "Please enter a valid discount %."); return; }
    if (Number(form.discountPercent) < 1 || Number(form.discountPercent) > 100) {
      crossAlert("Invalid discount", "Discount must be between 1% and 100%.");
      return;
    }
    if (form.maxUses && (isNaN(form.maxUses) || Number(form.maxUses) < 1)) {
      crossAlert("Invalid usage limit", "Usage limit must be a positive number.");
      return;
    }
    if (form.minSpend && (isNaN(form.minSpend) || Number(form.minSpend) < 0)) {
      crossAlert("Invalid minimum spend", "Minimum spend must be a positive number.");
      return;
    }
    if (form.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiryDate)) {
      crossAlert("Invalid date", "Please enter date in YYYY-MM-DD format (e.g. 2025-12-31).");
      return;
    }

    setLoading(true);
    try {
      const promoData = {
        code:            form.code.trim().toUpperCase(),
        discountPercent: Number(form.discountPercent),
        description:     form.description,
        maxUses:         form.maxUses    ? Number(form.maxUses) : null,
        expiryDate:      form.expiryDate || null,
        onePerCustomer:  form.onePerCustomer,
        minSpend:        form.minSpend   ? Number(form.minSpend) : null,
        active:          true,
        usedCount:       0,
        usedBy:          [], // array of customerIds who used this code
      };

      let updated;
      if (editing) {
        updated = promos.map((p) =>
          p.id === editing.id
            ? { ...p, ...promoData, usedCount: p.usedCount || 0, usedBy: p.usedBy || [] }
            : p
        );
      } else {
        if (promos.find((p) => p.code === promoData.code)) {
          crossAlert("Duplicate code", "A promo code with this name already exists.");
          setLoading(false);
          return;
        }
        updated = [...promos, { id: generateId(), ...promoData }];
      }

      await saveSalon(salonId, { promoCodes: updated });
      setPromos(updated);
      setShowModal(false);
    } catch (err) {
      crossAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (promo) => {
    const updated = promos.map((p) =>
      p.id === promo.id ? { ...p, active: !p.active } : p
    );
    try {
      await saveSalon(salonId, { promoCodes: updated });
      setPromos(updated);
    } catch (err) {
      crossAlert("Error", err.message);
    }
  };

  const handleDelete = (promo) => {
    crossAlert(
      "Delete promo code?",
      `Remove "${promo.code}" (${promo.discountPercent}% off)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = promos.filter((p) => p.id !== promo.id);
            try {
              await saveSalon(salonId, { promoCodes: updated });
              setPromos(updated);
            } catch (err) {
              crossAlert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  // Check if a promo is expired
  const isExpired = (promo) => {
    if (!promo.expiryDate) return false;
    return new Date(promo.expiryDate) < new Date();
  };

  // Check if usage limit reached
  const isExhausted = (promo) => {
    if (!promo.maxUses) return false;
    return (promo.usedCount || 0) >= promo.maxUses;
  };

  const getPromoStatus = (promo) => {
    if (!promo.active)      return { label: "Inactive",  color: "#9ca3af", bg: "#f3f4f6" };
    if (isExpired(promo))   return { label: "Expired",   color: "#ef4444", bg: "#fee2e2" };
    if (isExhausted(promo)) return { label: "Exhausted", color: "#d97706", bg: "#fef9c3" };
    return { label: "Active", color: "#16a34a", bg: "#dcfce7" };
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Promo Codes</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {promos.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🎟️</Text>
            <Text style={s.emptyText}>No promo codes yet</Text>
            <Text style={s.emptySub}>Tap "+ Add" to create your first promo code</Text>
          </View>
        )}

        {promos.map((promo) => {
          const status     = getPromoStatus(promo);
          const expired    = isExpired(promo);
          const exhausted  = isExhausted(promo);

          return (
            <View key={promo.id} style={[s.card, (expired || exhausted) && s.cardDim]}>
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={s.codeTag}>
                  <Text style={s.codeText}>{promo.code}</Text>
                </View>
                <View style={[s.discountBadge]}>
                  <Text style={s.discountText}>{promo.discountPercent}% off</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                  <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              {/* Description */}
              {promo.description ? <Text style={s.description}>{promo.description}</Text> : null}

              {/* Details */}
              <View style={s.details}>
                {promo.maxUses && (
                  <View style={s.detailChip}>
                    <Text style={s.detailText}>
                      🔢 {promo.usedCount || 0}/{promo.maxUses} used
                    </Text>
                  </View>
                )}
                {promo.expiryDate && (
                  <View style={[s.detailChip, expired && { backgroundColor: "#fee2e2" }]}>
                    <Text style={[s.detailText, expired && { color: "#ef4444" }]}>
                      📅 Expires {promo.expiryDate}
                    </Text>
                  </View>
                )}
                {promo.onePerCustomer && (
                  <View style={s.detailChip}>
                    <Text style={s.detailText}>👤 1 per customer</Text>
                  </View>
                )}
                {promo.minSpend && (
                  <View style={s.detailChip}>
                    <Text style={s.detailText}>💰 Min ৳{promo.minSpend}</Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(promo)}>
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.toggleBtn, { backgroundColor: promo.active ? "#fef9c3" : "#dcfce7" }]}
                  onPress={() => toggleActive(promo)}
                >
                  <Text style={[s.toggleBtnText, { color: promo.active ? "#d97706" : "#16a34a" }]}>
                    {promo.active ? "Deactivate" : "Activate"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(promo)}>
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>{editing ? "Edit Promo Code" : "New Promo Code"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">

            <Text style={m.label}>Promo Code *</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. SAVE20"
              value={form.code}
              onChangeText={(t) => setField("code", t.toUpperCase())}
              autoCapitalize="characters"
            />

            <Text style={m.label}>Discount % *</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 20"
              value={form.discountPercent}
              onChangeText={(t) => setField("discountPercent", t)}
              keyboardType="numeric"
            />

            <Text style={m.label}>Description (optional)</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 20% off for new customers"
              value={form.description}
              onChangeText={(t) => setField("description", t)}
            />

            <View style={m.divider} />

            {/* Usage limit */}
            <Text style={m.label}>Usage limit</Text>
            <Text style={m.hint}>How many times can this code be used total? Leave blank for unlimited.</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 100 (blank = unlimited)"
              value={form.maxUses}
              onChangeText={(t) => setField("maxUses", t)}
              keyboardType="numeric"
            />

            {/* Expiry date */}
            <Text style={m.label}>Expiry date</Text>
            <Text style={m.hint}>Leave blank for no expiry.</Text>
            <TextInput
              style={m.input}
              placeholder="YYYY-MM-DD (e.g. 2025-12-31)"
              value={form.expiryDate}
              onChangeText={(t) => setField("expiryDate", t)}
              keyboardType="numbers-and-punctuation"
            />

            {/* Minimum spend */}
            <Text style={m.label}>Minimum spend (৳)</Text>
            <Text style={m.hint}>Customer must spend at least this amount. Leave blank for no minimum.</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 500 (blank = no minimum)"
              value={form.minSpend}
              onChangeText={(t) => setField("minSpend", t)}
              keyboardType="numeric"
            />

            {/* One per customer */}
            <View style={m.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={m.switchLabel}>One use per customer</Text>
                <Text style={m.hint}>Each customer can only use this code once.</Text>
              </View>
              <Switch
                value={form.onePerCustomer}
                onValueChange={(v) => setField("onePerCustomer", v)}
                trackColor={{ false: "#e5e7eb", true: "#bbf7d0" }}
                thumbColor={form.onePerCustomer ? "#16a34a" : "#9ca3af"}
              />
            </View>

            <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.saveBtnText}>{editing ? "Save Changes" : "Create Promo Code"}</Text>
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
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  cardDim:      { opacity: 0.75 },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  codeTag:      { backgroundColor: "#1a1a2e", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  codeText:     { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 2 },
  discountBadge:{ backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  discountText: { color: "#1d4ed8", fontWeight: "700", fontSize: 13 },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusText:   { fontSize: 12, fontWeight: "600" },
  description:  { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  details:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  detailChip:   { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  detailText:   { fontSize: 12, color: "#374151" },
  cardActions:  { flexDirection: "row", gap: 8 },
  editBtn:      { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  editBtnText:  { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  toggleBtn:    { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  toggleBtnText:{ fontSize: 13, fontWeight: "600" },
  deleteBtn:    { flex: 1, backgroundColor: "#fee2e2", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  deleteBtnText:{ fontSize: 13, fontWeight: "600", color: "#ef4444" },
  empty:        { alignItems: "center", marginTop: 80, gap: 8 },
  emptyEmoji:   { fontSize: 48 },
  emptyText:    { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:     { fontSize: 13, color: "#9ca3af" },
});

const m = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#fafafa" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:       { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:       { fontSize: 20, color: "#6b7280" },
  content:     { padding: 20, paddingBottom: 40 },
  label:       { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 4, marginTop: 16 },
  hint:        { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  input:       { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a2e" },
  divider:     { height: 1, backgroundColor: "#f3f4f6", marginTop: 20, marginBottom: 4 },
  switchRow:   { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  saveBtn:     { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
