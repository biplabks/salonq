// apps/customer/src/screens/ReceiptScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Animated,
} from "react-native";
import {
  doc, getDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { formatPrice, formatDate } from "../utils";

export default function ReceiptScreen({ route, navigation }) {
  const { salonId, entryId, salonName } = route.params;
  const [entry,        setEntry]        = useState(null);
  const [salon,        setSalon]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [promoCode,    setPromoCode]    = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError,   setPromoError]   = useState("");
  const [applying,     setApplying]     = useState(false);

  const checkAnim = useRef(new Animated.Value(0)).current;
  const user = getAuth().currentUser;

  useEffect(() => {
    // Fetch salon data once
    getDoc(doc(db, "salons", salonId)).then((snap) => {
      if (snap.exists()) setSalon({ id: snap.id, ...snap.data() });
    });

    // Subscribe to queue entry in real-time to detect payment confirmation
    const unsub = onSnapshot(
      doc(db, "salons", salonId, "queue", entryId),
      (snap) => {
        if (snap.exists()) {
          setEntry({ id: snap.id, ...snap.data() });
          setLoading(false);

          // Animate checkmark when payment confirmed
          if (snap.data().paymentStatus === "paid") {
            Animated.spring(checkAnim, {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }).start();
          }
        }
      }
    );
    return unsub;
  }, []);

  const subtotal    = (entry?.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
  const discountAmt = appliedPromo ? Math.round(subtotal * (appliedPromo.discountPercent / 100)) : 0;
  const total       = subtotal - discountAmt;
  const isPaid      = entry?.paymentStatus === "paid";
  const paymentMethod = entry?.paymentMethod || null;

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoError("Please enter a promo code"); return; }
    setApplying(true);
    setPromoError("");

    try {
      const promos = salon?.promoCodes || [];
      const promo  = promos.find((p) => p.code === code);

      if (!promo)        { setPromoError("❌ Invalid promo code"); return; }
      if (!promo.active) { setPromoError("❌ This promo code is no longer active"); return; }
      if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
        setPromoError(`❌ This code expired on ${promo.expiryDate}`); return;
      }
      if (promo.maxUses && (promo.usedCount || 0) >= promo.maxUses) {
        setPromoError("❌ This promo code has reached its usage limit"); return;
      }
      if (promo.onePerCustomer && user?.uid && (promo.usedBy || []).includes(user.uid)) {
        setPromoError("❌ You have already used this promo code"); return;
      }
      if (promo.minSpend && subtotal < promo.minSpend) {
        setPromoError(`❌ Minimum spend of ${formatPrice(promo.minSpend)} required`); return;
      }

      // Apply promo
      setAppliedPromo(promo);
      setPromoError("");

      // Update usage in Firestore
      const updatedPromos = promos.map((p) =>
        p.code === code
          ? {
              ...p,
              usedCount: (p.usedCount || 0) + 1,
              usedBy: user?.uid ? [...(p.usedBy || []), user.uid] : (p.usedBy || []),
            }
          : p
      );
      await updateDoc(doc(db, "salons", salonId), { promoCodes: updatedPromos });

      // Save applied promo to entry so salon staff can see it
      await updateDoc(doc(db, "salons", salonId, "queue", entryId), {
        promoCode:          code,
        discountPercent:    promo.discountPercent,
        discountAmount:     Math.round(subtotal * (promo.discountPercent / 100)),
        totalAfterDiscount: subtotal - Math.round(subtotal * (promo.discountPercent / 100)),
      });

    } catch (err) {
      setPromoError("Failed to apply promo code");
    } finally {
      setApplying(false);
    }
  };

  const handleRemovePromo = async () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
    await updateDoc(doc(db, "salons", salonId, "queue", entryId), {
      promoCode: null, discountPercent: 0, discountAmount: 0,
      totalAfterDiscount: subtotal,
    });
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#1a1a2e" size="large" /></View>;
  }

  // ── Payment confirmed screen ───────────────────────────────────────────────
  if (isPaid) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.paidScreen}>
          <Animated.View style={[s.checkCircle, {
            transform: [{ scale: checkAnim }],
            opacity:   checkAnim,
          }]}>
            <Text style={s.checkMark}>✓</Text>
          </Animated.View>
          <Text style={s.paidTitle}>Payment Confirmed!</Text>
          <Text style={s.paidSub}>Thank you for visiting {salonName}</Text>

          <View style={s.paidReceipt}>
            <View style={s.paidRow}>
              <Text style={s.paidLabel}>Amount paid</Text>
              <Text style={s.paidValue}>{formatPrice(total)}</Text>
            </View>
            {paymentMethod && (
              <View style={s.paidRow}>
                <Text style={s.paidLabel}>Payment method</Text>
                <Text style={s.paidValue}>{paymentMethod}</Text>
              </View>
            )}
            {appliedPromo && (
              <View style={s.paidRow}>
                <Text style={[s.paidLabel, { color: "#16a34a" }]}>Discount applied</Text>
                <Text style={[s.paidValue, { color: "#16a34a" }]}>-{formatPrice(discountAmt)}</Text>
              </View>
            )}
            <View style={s.paidRow}>
              <Text style={s.paidLabel}>Date</Text>
              <Text style={s.paidValue}>{formatDate(entry?.completedAt)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}
          >
            <Text style={s.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Awaiting payment screen ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Receipt</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Salon info */}
        <View style={s.salonCard}>
          <Text style={s.salonEmoji}>✂️</Text>
          <Text style={s.salonName}>{salonName}</Text>
          <Text style={s.salonAddr}>{salon?.address || ""}</Text>
          <Text style={s.receiptDate}>{formatDate(entry?.completedAt)}</Text>
        </View>

        {/* Services */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Services</Text>
          {(entry?.services || []).map((sv, i) => (
            <View key={i} style={s.serviceRow}>
              <Text style={s.serviceName}>{sv.name}</Text>
              <Text style={s.servicePrice}>{formatPrice(sv.price)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          {appliedPromo && (
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: "#16a34a" }]}>
                Discount ({appliedPromo.discountPercent}% — {appliedPromo.code})
              </Text>
              <Text style={[s.summaryValue, { color: "#16a34a" }]}>-{formatPrice(discountAmt)}</Text>
            </View>
          )}
          <View style={s.divider} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatPrice(total)}</Text>
          </View>
        </View>

        {/* Promo code */}
        {!appliedPromo ? (
          <View style={s.promoCard}>
            <Text style={s.cardTitle}>Have a promo code?</Text>
            <View style={s.promoRow}>
              <TextInput
                style={s.promoInput}
                placeholder="Enter code"
                value={promoCode}
                onChangeText={(t) => { setPromoCode(t.toUpperCase()); setPromoError(""); }}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={s.promoBtn} onPress={handleApplyPromo} disabled={applying}>
                {applying
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.promoBtnText}>Apply</Text>
                }
              </TouchableOpacity>
            </View>
            {promoError ? <Text style={s.promoError}>{promoError}</Text> : null}
          </View>
        ) : (
          <View style={s.promoAppliedCard}>
            <Text style={s.promoAppliedText}>
              🎉 {appliedPromo.code} — {appliedPromo.discountPercent}% off!
            </Text>
            <TouchableOpacity onPress={handleRemovePromo}>
              <Text style={s.promoRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Awaiting payment */}
        <View style={s.awaitingCard}>
          <Text style={s.awaitingEmoji}>⏳</Text>
          <Text style={s.awaitingTitle}>Awaiting Payment</Text>
          <Text style={s.awaitingNote}>
            Please pay <Text style={s.awaitingAmount}>{formatPrice(total)}</Text> at the
            salon counter. Staff will confirm your payment.
          </Text>
          <View style={s.paymentMethods}>
            <View style={s.paymentMethod}><Text style={s.paymentMethodText}>💵 Cash</Text></View>
            <View style={s.paymentMethod}><Text style={s.paymentMethodText}>💳 Card</Text></View>
            <View style={s.paymentMethod}><Text style={s.paymentMethodText}>📱 bKash</Text></View>
          </View>
          <Text style={s.awaitingHint}>
            This page will automatically update when staff confirms your payment.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: "#fafafa" },
  center:             { flex: 1, alignItems: "center", justifyContent: "center" },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:               { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  headerTitle:        { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  content:            { padding: 16, gap: 12, paddingBottom: 40 },
  salonCard:          { backgroundColor: "#1a1a2e", borderRadius: 18, padding: 24, alignItems: "center" },
  salonEmoji:         { fontSize: 36, marginBottom: 8 },
  salonName:          { fontSize: 20, fontWeight: "800", color: "#fff" },
  salonAddr:          { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  receiptDate:        { fontSize: 12, color: "#6b7280", marginTop: 8 },
  card:               { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTitle:          { fontSize: 14, fontWeight: "700", color: "#6b7280", marginBottom: 14 },
  serviceRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  serviceName:        { fontSize: 14, color: "#1a1a2e" },
  servicePrice:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  divider:            { height: 1, backgroundColor: "#f3f4f6", marginVertical: 10 },
  summaryRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel:       { fontSize: 13, color: "#6b7280", flex: 1 },
  summaryValue:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  totalRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel:         { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  totalValue:         { fontSize: 20, fontWeight: "900", color: "#1a1a2e" },
  promoCard:          { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  promoRow:           { flexDirection: "row", gap: 10, marginTop: 4 },
  promoInput:         { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, fontSize: 15, fontWeight: "700", letterSpacing: 2, color: "#1a1a2e" },
  promoBtn:           { backgroundColor: "#1a1a2e", borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  promoBtnText:       { color: "#fff", fontWeight: "700", fontSize: 14 },
  promoError:         { color: "#ef4444", fontSize: 12, marginTop: 8, lineHeight: 18 },
  promoAppliedCard:   { backgroundColor: "#dcfce7", borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  promoAppliedText:   { fontSize: 14, color: "#16a34a", fontWeight: "600" },
  promoRemove:        { fontSize: 13, color: "#6b7280" },
  awaitingCard:       { backgroundColor: "#fff", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  awaitingEmoji:      { fontSize: 40, marginBottom: 12 },
  awaitingTitle:      { fontSize: 18, fontWeight: "800", color: "#1a1a2e", marginBottom: 8 },
  awaitingNote:       { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22, marginBottom: 16 },
  awaitingAmount:     { color: "#1a1a2e", fontWeight: "800" },
  paymentMethods:     { flexDirection: "row", gap: 8, marginBottom: 16 },
  paymentMethod:      { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  paymentMethodText:  { fontSize: 13, color: "#374151", fontWeight: "500" },
  awaitingHint:       { fontSize: 12, color: "#9ca3af", textAlign: "center" },

  // Payment confirmed screen
  paidScreen:         { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  checkCircle:        { width: 100, height: 100, borderRadius: 50, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: "#16a34a", shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  checkMark:          { fontSize: 52, color: "#fff", fontWeight: "800" },
  paidTitle:          { fontSize: 26, fontWeight: "900", color: "#1a1a2e", marginBottom: 8 },
  paidSub:            { fontSize: 14, color: "#6b7280", marginBottom: 28, textAlign: "center" },
  paidReceipt:        { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#e5e7eb", width: "100%", marginBottom: 24 },
  paidRow:            { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  paidLabel:          { fontSize: 14, color: "#6b7280" },
  paidValue:          { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  doneBtn:            { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: "center" },
  doneBtnText:        { color: "#fff", fontSize: 16, fontWeight: "700" },
});
