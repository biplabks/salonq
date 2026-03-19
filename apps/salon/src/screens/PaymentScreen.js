// apps/salon/src/screens/PaymentScreen.js
// Shown when staff taps "Collect Payment" on a completed queue entry.

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Modal,
} from "react-native";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase";
import { crossAlert } from "../utils/crossAlert";

const PAYMENT_METHODS = [
  { id: "cash",  label: "💵 Cash",  color: "#16a34a" },
  { id: "card",  label: "💳 Card",  color: "#3B82F6" },
  { id: "bkash", label: "📱 bKash", color: "#d97706" },
];

const formatPrice = (amount) => `৳${Number(amount || 0).toLocaleString()}`;

export default function PaymentScreen({ visible, onClose, entry, salonId, salonName }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [liveEntry,      setLiveEntry]      = useState(entry);

  useEffect(() => {
    if (!visible || !salonId || !entry?.id) return;
    setLiveEntry(entry); // reset when opened
    const unsub = onSnapshot(
      doc(firestore, "salons", salonId, "queue", entry.id),
      (snap) => {
        if (snap.exists()) setLiveEntry({ id: snap.id, ...snap.data() });
      }
    );
    return unsub;
  }, [visible, entry?.id]);

  if (!entry) return null;

  // liveEntry may still be null on first render before useEffect fires — fall back to entry prop
  const current     = liveEntry || entry;
  const subtotal    = (current.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
  const discountAmt = current.discountAmount || 0;
  const total       = current.totalAfterDiscount || subtotal;

  const handleConfirmPayment = async () => {
    if (!selectedMethod) {
      crossAlert("Select payment method", "Please select how the customer is paying.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(firestore, "salons", salonId, "queue", current.id), {
        paymentStatus: "paid",
        paymentMethod: PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label || selectedMethod,
        paidAt:        serverTimestamp(),
        totalPaid:     total,
      });
      onClose(true); // true = payment confirmed
    } catch (err) {
      crossAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Collect Payment</Text>
          <TouchableOpacity onPress={() => onClose(false)}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Customer info */}
        <View style={s.customerCard}>
          <View style={s.customerAvatar}>
            <Text style={{ fontSize: 24 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.customerName}>{current.customerName}</Text>
            <Text style={s.customerServices}>
              {(current.services || []).map((sv) => sv.name).join(", ")}
            </Text>
          </View>
        </View>

        {/* Promo applied badge */}
        {current.promoCode && (
          <View style={s.promoBadge}>
            <Text style={s.promoBadgeText}>
              🎟️ Promo {current.promoCode} applied — {current.discountPercent}% off
            </Text>
          </View>
        )}

        {/* Bill breakdown */}
        <View style={s.billCard}>
          {(current.services || []).map((sv, i) => (
            <View key={i} style={s.billRow}>
              <Text style={s.billService}>{sv.name}</Text>
              <Text style={s.billPrice}>{formatPrice(sv.price)}</Text>
            </View>
          ))}

          <View style={s.divider} />

          <View style={s.billRow}>
            <Text style={s.billLabel}>Subtotal</Text>
            <Text style={s.billValue}>{formatPrice(subtotal)}</Text>
          </View>

          {discountAmt > 0 && (
            <View style={s.billRow}>
              <Text style={[s.billLabel, { color: "#16a34a" }]}>
                Discount ({current.promoCode} — {current.discountPercent}% off)
              </Text>
              <Text style={[s.billValue, { color: "#16a34a" }]}>
                -{formatPrice(discountAmt)}
              </Text>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total to collect</Text>
            <Text style={s.totalValue}>{formatPrice(total)}</Text>
          </View>
        </View>

        {/* Payment method */}
        <Text style={s.methodTitle}>Payment method</Text>
        <View style={s.methods}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                s.methodBtn,
                selectedMethod === method.id && { borderColor: method.color, borderWidth: 2, backgroundColor: method.color + "15" },
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <Text style={[
                s.methodText,
                selectedMethod === method.id && { color: method.color, fontWeight: "700" },
              ]}>
                {method.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={[s.confirmBtn, !selectedMethod && { opacity: 0.5 }]}
          onPress={handleConfirmPayment}
          disabled={loading || !selectedMethod}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.confirmBtnText}>✅ Confirm Payment — {formatPrice(total)}</Text>
          }
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fafafa", padding: 20 },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:           { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  close:           { fontSize: 20, color: "#6b7280" },
  customerCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  customerAvatar:  { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  customerName:    { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  customerServices:{ fontSize: 12, color: "#6b7280", marginTop: 2 },
  billCard:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  billRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  billService:     { fontSize: 14, color: "#1a1a2e" },
  billPrice:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  billLabel:       { fontSize: 13, color: "#6b7280", flex: 1 },
  billValue:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  divider:         { height: 1, backgroundColor: "#f3f4f6", marginVertical: 6 },
  totalRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  totalLabel:      { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  totalValue:      { fontSize: 20, fontWeight: "900", color: "#1a1a2e" },
  methodTitle:     { fontSize: 14, fontWeight: "700", color: "#6b7280", marginBottom: 12 },
  methods:         { flexDirection: "row", gap: 10, marginBottom: 24 },
  methodBtn:       { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  methodText:      { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  confirmBtn:      { backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  confirmBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  promoBadge:      { backgroundColor: "#dcfce7", borderRadius: 8, padding: 10, marginBottom: 12 },
  promoBadgeText:  { color: "#16a34a", fontWeight: "600", fontSize: 13 },
});
