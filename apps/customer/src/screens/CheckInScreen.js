// apps/customer/src/screens/CheckInScreen.js
import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, Modal,
} from "react-native";
import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinQueue } from "../firebase";
import { formatPrice, formatWait, calcEstimatedWait } from "../utils";

export default function CheckInScreen({ route, navigation }) {
  const { salon } = route.params;
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [queueBlockModal, setQueueBlockModal] = useState(null); // { salonName }

  const toggleService = (service) =>
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );

  const totalPrice = selectedServices.reduce((s, sv) => s + sv.price, 0);
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.durationMin, 0);
  const activeStylists = (salon.stylists || []).filter((s) => s.status === "available").length || 1;
  const estimatedWait = calcEstimatedWait((salon.queueCount || 0) + 1, selectedServices, activeStylists);

  const handleCheckIn = async () => {
    if (!selectedServices.length) { Alert.alert("Select a service"); return; }

    // Block if already in an active queue
    const existing = await AsyncStorage.getItem("activeQueue");
    if (existing) {
      try {
        const { salonId: activeSalonId, entryId, salonName } = JSON.parse(existing);
        // Verify entry is still active in Firestore before blocking
        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const snap = await getDoc(doc(db, "salons", activeSalonId, "queue", entryId));
        const activeStatuses = ["waiting", "called", "in-service"];
        if (snap.exists() && activeStatuses.includes(snap.data().status)) {
          setQueueBlockModal({ salonName: salonName || "a salon", salonId: activeSalonId, entryId });
          return;
        }
        // Entry is done/missing — clear stale record
        await AsyncStorage.removeItem("activeQueue");
      } catch {
        await AsyncStorage.removeItem("activeQueue");
      }
    }

    setLoading(true);
    try {
      const user = getAuth().currentUser;
      const entryRef = await joinQueue({
        salonId:      salon.id,
        customerId:   user?.uid ?? null,
        customerName: user?.displayName || user?.email || "Guest",
        services:     selectedServices,
        stylistId:    selectedStylist?.id ?? null,
      });

      // Save active queue to AsyncStorage
      const activeQueue = {
        salonId:   salon.id,
        entryId:   entryRef.id,
        salonName: salon.name,
      };
      await AsyncStorage.setItem("activeQueue", JSON.stringify(activeQueue));
      console.log("Saved activeQueue:", activeQueue);

      // Navigate to Queue tab and pass params directly
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Main",
            state: {
              routes: [
                { name: "Explore" },
                {
                  name: "Queue",
                  params: {
                    salonId:   salon.id,
                    entryId:   entryRef.id,
                    salonName: salon.name,
                  },
                },
                { name: "Profile" },
              ],
              index: 1, // focus Queue tab
            },
          },
        ],
      });
    } catch (err) {
      console.error("CheckIn error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Already-in-queue modal */}
      <Modal transparent animationType="fade" visible={!!queueBlockModal} onRequestClose={() => setQueueBlockModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalIcon}>🔒</Text>
            <Text style={s.modalTitle}>Already in a queue</Text>
            <Text style={s.modalBody}>
              You're currently waiting at{" "}
              <Text style={{ fontWeight: "700", color: "#1a1a2e" }}>{queueBlockModal?.salonName}</Text>.
              {"\n"}Leave that queue before joining a new one.
            </Text>
            <TouchableOpacity
              style={s.modalPrimary}
              onPress={() => {
                setQueueBlockModal(null);
                navigation.navigate("Main", {
                  screen: "Queue",
                  params: {
                    salonId:   queueBlockModal?.salonId,
                    entryId:   queueBlockModal?.entryId,
                    salonName: queueBlockModal?.salonName,
                  },
                });
              }}
            >
              <Text style={s.modalPrimaryText}>View my queue →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondary} onPress={() => setQueueBlockModal(null)}>
              <Text style={s.modalSecondaryText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}>
          <Text style={s.back}>{step > 1 ? "← Back" : "← Cancel"}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{salon.name}</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Step indicator */}
      <View style={s.steps}>
        {["Services", "Stylist", "Confirm"].map((label, i) => (
          <View key={label} style={s.stepItem}>
            <View style={[s.stepCircle, step > i && s.stepDone, step === i + 1 && s.stepActive]}>
              <Text style={[s.stepNum, (step > i || step === i + 1) && { color: "#fff" }]}>{i + 1}</Text>
            </View>
            <Text style={[s.stepLabel, step === i + 1 && { color: "#1a1a2e", fontWeight: "600" }]}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── Step 1: Services ── */}
        {step === 1 && <>
          <Text style={s.sectionTitle}>Choose your services</Text>
          {(salon.services || []).map((service) => {
            const selected = !!selectedServices.find((s) => s.id === service.id);
            return (
              <TouchableOpacity
                key={service.id}
                style={[s.serviceCard, selected && s.serviceCardSel]}
                onPress={() => toggleService(service)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.serviceName, selected && { color: "#fff" }]}>{service.name}</Text>
                  <Text style={[s.serviceMeta, selected && { color: "#e5e7eb" }]}>{service.durationMin} min</Text>
                </View>
                <View style={s.serviceRight}>
                  <Text style={[s.servicePrice, selected && { color: "#fff" }]}>{formatPrice(service.price)}</Text>
                  <View style={[s.check, selected && s.checkSel]}>
                    {selected && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {!salon.services?.length && <Text style={s.empty}>No services available.</Text>}
        </>}

        {/* ── Step 2: Stylist ── */}
        {step === 2 && <>
          <Text style={s.sectionTitle}>Choose a stylist</Text>
          <Text style={s.sectionSub}>Optional — leave blank for next available</Text>

          <TouchableOpacity
            style={[s.stylistCard, !selectedStylist && s.stylistCardSel]}
            onPress={() => setSelectedStylist(null)}
          >
            <Text style={{ fontSize: 28 }}>🎲</Text>
            <Text style={[s.stylistName, !selectedStylist && { color: "#fff" }]}>Any available stylist</Text>
          </TouchableOpacity>

          {(salon.stylists || []).filter((st) => st.status !== "off").map((stylist) => (
            <TouchableOpacity
              key={stylist.id}
              style={[s.stylistCard, selectedStylist?.id === stylist.id && s.stylistCardSel]}
              onPress={() => setSelectedStylist(stylist)}
            >
              <Text style={{ fontSize: 28 }}>💇</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.stylistName, selectedStylist?.id === stylist.id && { color: "#fff" }]}>
                  {stylist.name}
                </Text>
                <Text style={[s.stylistStatus, selectedStylist?.id === stylist.id && { color: "#e5e7eb" }]}>
                  {stylist.status === "available" ? "✅ Available" : "⏳ Busy"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && <>
          <Text style={s.sectionTitle}>Confirm check-in</Text>
          <View style={s.confirmCard}>
            {[
              ["Salon",     salon.name],
              ["Services",  selectedServices.map((sv) => sv.name).join(", ")],
              ["Stylist",   selectedStylist?.name || "Any available"],
              ["Duration",  `~${totalDuration} min`],
              ["Est. wait", formatWait(estimatedWait), "#d97706"],
            ].map(([label, value, color]) => (
              <View key={label} style={s.confirmRow}>
                <Text style={s.confirmLabel}>{label}</Text>
                <Text style={[s.confirmValue, color && { color, fontWeight: "700" }]}>{value}</Text>
              </View>
            ))}
            <View style={s.divider} />
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Total</Text>
              <Text style={[s.confirmValue, { fontWeight: "800", fontSize: 16 }]}>{formatPrice(totalPrice)}</Text>
            </View>
          </View>
          <Text style={s.disclaimer}>
            We'll notify you when it's almost your turn. Please arrive by then.
          </Text>
        </>}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {selectedServices.length > 0 && (
          <Text style={s.footerMeta}>
            {selectedServices.length} service(s) · {formatPrice(totalPrice)} · {totalDuration} min
          </Text>
        )}
        <TouchableOpacity
          style={[s.nextBtn, step === 1 && !selectedServices.length && { opacity: 0.4 }]}
          onPress={() => step < 3 ? setStep(step + 1) : handleCheckIn()}
          disabled={loading || (step === 1 && !selectedServices.length)}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.nextBtnText}>{step === 3 ? "✅ Join Queue" : "Next →"}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#fafafa" },
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:          { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 70 },
  topTitle:      { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  steps:         { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stepItem:      { alignItems: "center", gap: 4 },
  stepCircle:    { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  stepActive:    { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stepDone:      { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepNum:       { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stepLabel:     { fontSize: 11, color: "#9ca3af" },
  content:       { padding: 20, paddingBottom: 140 },
  sectionTitle:  { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  sectionSub:    { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  serviceCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  serviceCardSel:{ backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  serviceName:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  serviceMeta:   { fontSize: 12, color: "#6b7280", marginTop: 2 },
  serviceRight:  { alignItems: "flex-end", gap: 6 },
  servicePrice:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  check:         { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkSel:      { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stylistCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: "#e5e7eb" },
  stylistCardSel:{ backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stylistName:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistStatus: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  confirmCard:   { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  confirmRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  confirmLabel:  { fontSize: 14, color: "#6b7280" },
  confirmValue:  { fontSize: 14, color: "#1a1a2e", fontWeight: "500", flex: 1, textAlign: "right" },
  divider:       { height: 1, backgroundColor: "#f3f4f6", marginVertical: 4 },
  disclaimer:    { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 16, lineHeight: 18 },
  footer:        { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 16 },
  footerMeta:    { textAlign: "center", color: "#6b7280", fontSize: 13, marginBottom: 8 },
  nextBtn:       { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextBtnText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  empty:         { color: "#9ca3af", textAlign: "center", paddingTop: 24 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox:      { backgroundColor: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalIcon:     { fontSize: 44, marginBottom: 12 },
  modalTitle:    { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 10, textAlign: "center" },
  modalBody:     { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  modalPrimary:  { backgroundColor: "#1a1a2e", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center", marginBottom: 10 },
  modalPrimaryText:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalSecondary:     { paddingVertical: 10 },
  modalSecondaryText: { color: "#9ca3af", fontSize: 14 },
});