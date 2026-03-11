// apps/customer/src/screens/CheckInScreen.js
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { getAuth } from "firebase/auth";
import { joinQueue } from "salonq-shared/firebase";
import { formatPrice, formatWait, calcEstimatedWait } from "salonq-shared/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function CheckInScreen({ route, navigation }) {
  const { salon } = route.params;
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStylist,  setSelectedStylist]  = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [step,             setStep]             = useState(1); // 1 = services, 2 = stylist, 3 = confirm

  const toggleService = (service) => {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const totalPrice    = selectedServices.reduce((s, sv) => s + sv.price, 0);
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.durationMin, 0);
  const estimatedWait = calcEstimatedWait(
    (salon.queueCount || 0) + 1,
    selectedServices,
    (salon.stylists || []).filter((s) => s.status === "available").length || 1
  );

  const handleCheckIn = async () => {
    if (!selectedServices.length) {
      Alert.alert("Select a service", "Please choose at least one service.");
      return;
    }
    setLoading(true);
    try {
      const user     = getAuth().currentUser;
      const entryRef = await joinQueue({
        salonId:      salon.id,
        customerId:   user?.uid ?? null,
        customerName: user?.displayName || user?.email || "Guest",
        services:     selectedServices,
        stylistId:    selectedStylist?.id ?? null,
      });

      // Persist active check-in so QueueTracker can load it on app re-open
      await AsyncStorage.setItem(
        "activeQueue",
        JSON.stringify({ salonId: salon.id, entryId: entryRef.id, salonName: salon.name })
      );

      navigation.reset({
        index: 0,
        routes: [{ name: "Main", params: { screen: "Queue", params: { salonId: salon.id, entryId: entryRef.id, salonName: salon.name } } }],
      });
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}>
          <Text style={styles.backText}>← {step > 1 ? "Back" : "Cancel"}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{salon.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        {["Services", "Stylist", "Confirm"].map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepCircle, step > i && styles.stepDone, step === i + 1 && styles.stepActive]}>
              <Text style={[styles.stepNum, (step > i || step === i + 1) && { color: "#fff" }]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

        {/* ─── Step 1: Select Services ──────────────────────── */}
        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>Choose your services</Text>
            {(salon.services || []).map((service) => {
              const selected = !!selectedServices.find((s) => s.id === service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                  onPress={() => toggleService(service)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, selected && styles.serviceNameSelected]}>{service.name}</Text>
                    <Text style={styles.serviceMeta}>{service.durationMin} min</Text>
                  </View>
                  <View style={styles.serviceRight}>
                    <Text style={[styles.servicePrice, selected && { color: "#fff" }]}>
                      {formatPrice(service.price)}
                    </Text>
                    <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                      {selected && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✓</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ─── Step 2: Choose Stylist ───────────────────────── */}
        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>Choose a stylist</Text>
            <Text style={styles.sectionSub}>Optional — leave blank for next available</Text>

            <TouchableOpacity
              style={[styles.stylistCard, !selectedStylist && styles.stylistCardSelected]}
              onPress={() => setSelectedStylist(null)}
            >
              <Text style={styles.stylistEmoji}>🎲</Text>
              <Text style={[styles.stylistName, !selectedStylist && { color: "#fff" }]}>Any available stylist</Text>
            </TouchableOpacity>

            {(salon.stylists || [])
              .filter((st) => st.status === "available" || st.status === "busy")
              .map((stylist) => (
                <TouchableOpacity
                  key={stylist.id}
                  style={[styles.stylistCard, selectedStylist?.id === stylist.id && styles.stylistCardSelected]}
                  onPress={() => setSelectedStylist(stylist)}
                >
                  <Text style={styles.stylistEmoji}>💇</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stylistName, selectedStylist?.id === stylist.id && { color: "#fff" }]}>
                      {stylist.name}
                    </Text>
                    <Text style={[styles.stylistStatus, selectedStylist?.id === stylist.id && { color: "#e5e7eb" }]}>
                      {stylist.status === "available" ? "✅ Available" : "⏳ Currently busy"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
          </>
        )}

        {/* ─── Step 3: Confirm ──────────────────────────────── */}
        {step === 3 && (
          <>
            <Text style={styles.sectionTitle}>Confirm check-in</Text>

            <View style={styles.confirmCard}>
              <Row label="Salon"   value={salon.name} />
              <Row label="Services" value={selectedServices.map((s) => s.name).join(", ")} />
              <Row label="Stylist"  value={selectedStylist?.name || "Any available"} />
              <Row label="Duration" value={`~${totalDuration} min`} />
              <Row label="Est. wait" value={formatWait(estimatedWait)} highlight />
              <View style={styles.divider} />
              <Row label="Total" value={formatPrice(totalPrice)} bold />
            </View>

            <Text style={styles.disclaimer}>
              You'll receive a notification when it's almost your turn. Please arrive by then.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.footer}>
        {selectedServices.length > 0 && (
          <View style={styles.footerMeta}>
            <Text style={styles.footerMetaText}>
              {selectedServices.length} service{selectedServices.length > 1 ? "s" : ""} · {formatPrice(totalPrice)} · {totalDuration} min
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !selectedServices.length && step === 1 && styles.nextBtnDisabled]}
          onPress={() => {
            if (step < 3) setStep(step + 1);
            else handleCheckIn();
          }}
          disabled={loading || (step === 1 && !selectedServices.length)}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.nextBtnText}>
                {step === 3 ? "✅ Join Queue" : "Next →"}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const Row = ({ label, value, highlight, bold }) => (
  <View style={rowStyles.row}>
    <Text style={rowStyles.label}>{label}</Text>
    <Text style={[rowStyles.value, highlight && rowStyles.highlight, bold && rowStyles.bold]}>
      {value}
    </Text>
  </View>
);

const rowStyles = StyleSheet.create({
  row:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  label:     { fontSize: 14, color: "#6b7280" },
  value:     { fontSize: 14, color: "#1a1a2e", fontWeight: "500", flex: 1, textAlign: "right" },
  highlight: { color: "#d97706", fontWeight: "700" },
  bold:      { fontWeight: "800", fontSize: 16 },
});

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fafafa" },
  topBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backText:   { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  topTitle:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  steps:      { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stepItem:   { alignItems: "center", gap: 4 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  stepActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stepDone:   { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepNum:    { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stepLabel:  { fontSize: 11, color: "#9ca3af" },
  stepLabelActive: { color: "#1a1a2e", fontWeight: "600" },
  content:    { padding: 20, paddingBottom: 120 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  sectionSub:   { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  serviceCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  serviceCardSelected: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  serviceName: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  serviceNameSelected: { color: "#fff" },
  serviceMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  serviceRight:{ alignItems: "flex-end", gap: 6 },
  servicePrice:{ fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkCircleSelected: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stylistCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: "#e5e7eb" },
  stylistCardSelected: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stylistEmoji:{ fontSize: 28 },
  stylistName: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistStatus:{ fontSize: 12, color: "#6b7280", marginTop: 2 },
  confirmCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  divider:     { height: 1, backgroundColor: "#f3f4f6", marginVertical: 8 },
  disclaimer:  { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 16, lineHeight: 18 },
  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 16 },
  footerMeta:  { marginBottom: 10 },
  footerMetaText: { textAlign: "center", color: "#6b7280", fontSize: 13 },
  nextBtn:     { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
