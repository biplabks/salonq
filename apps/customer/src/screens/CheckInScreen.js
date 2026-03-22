// apps/customer/src/screens/CheckInScreen.js
// Per-person services + stylist selection for group bookings

import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, BackHandler,
} from "react-native";
import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinQueue, getCustomer } from "../firebase";
import { formatPrice, formatWait, calcEstimatedWait } from "../utils";

// Turn "biplab.saha" or "biplab_saha" → "Biplab Saha"
const formatEmailName = (email) =>
  (email?.split("@")[0] || "Me")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const RELATIONSHIP_EMOJI = {
  Spouse: "💑", Child: "👶", Parent: "👨‍👩‍👦",
  Sibling: "👫", Grandparent: "👴", Grandchild: "🧒",
  Friend: "👥", Other: "👤",
};

// ── Per-person card component ─────────────────────────────────────────────────
function PersonCard({ person, salon, onUpdate }) {
  const [expanded, setExpanded] = useState(false);

  const toggleService = (service) => {
    const current = person.services || [];
    const updated  = current.find((s) => s.id === service.id)
      ? current.filter((s) => s.id !== service.id)
      : [...current, service];
    onUpdate({ ...person, services: updated });
  };

  const selectStylist = (stylist) => {
    onUpdate({ ...person, stylistId: stylist?.id || null, stylistName: stylist?.name || null });
    setExpanded(false);
  };

  const personServices  = person.services  || [];
  const personTotal     = personServices.reduce((s, sv) => s + (sv.price || 0), 0);
  const personDuration  = personServices.reduce((s, sv) => s + (sv.durationMin || 0), 0);
  const hasServices     = personServices.length > 0;

  return (
    <View style={pc.card}>
      {/* Person header */}
      <TouchableOpacity style={pc.header} onPress={() => setExpanded(!expanded)}>
        <View style={pc.avatar}>
          <Text style={{ fontSize: 24 }}>
            {person.isSelf ? "😊" : (RELATIONSHIP_EMOJI[person.relationship] || "👤")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pc.name}>{person.name}</Text>
          {hasServices ? (
            <Text style={pc.servicesSummary} numberOfLines={1}>
              {personServices.map((s) => s.name).join(", ")} · {formatPrice(personTotal)}
            </Text>
          ) : (
            <Text style={pc.noServices}>Tap to select services</Text>
          )}
          {person.stylistName && (
            <Text style={pc.stylistTag}>💇 {person.stylistName}</Text>
          )}
        </View>
        <View style={[pc.statusDot, { backgroundColor: hasServices ? "#16a34a" : "#e5e7eb" }]} />
        <Text style={pc.chevron}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {/* Expanded services + stylist picker */}
      {expanded && (
        <View style={pc.expanded}>
          {/* Services */}
          <Text style={pc.sectionLabel}>Services</Text>
          {(salon.services || []).map((service) => {
            const selected = !!personServices.find((s) => s.id === service.id);
            return (
              <TouchableOpacity
                key={service.id}
                style={[pc.serviceRow, selected && pc.serviceRowSel]}
                onPress={() => toggleService(service)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[pc.serviceName, selected && { color: "#fff" }]}>{service.name}</Text>
                  <Text style={[pc.serviceMeta, selected && { color: "#e5e7eb" }]}>{service.durationMin} min</Text>
                </View>
                <Text style={[pc.servicePrice, selected && { color: "#fff" }]}>{formatPrice(service.price)}</Text>
                <View style={[pc.check, selected && pc.checkSel]}>
                  {selected && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Stylist */}
          {hasServices && <>
            <Text style={[pc.sectionLabel, { marginTop: 16 }]}>Stylist (optional)</Text>
            <TouchableOpacity
              style={[pc.stylistRow, !person.stylistId && pc.stylistRowSel]}
              onPress={() => selectStylist(null)}
            >
              <Text style={{ fontSize: 22 }}>🎲</Text>
              <Text style={[pc.stylistName, !person.stylistId && { color: "#fff" }]}>Any available</Text>
            </TouchableOpacity>
            {(salon.stylists || []).filter((st) => st.status !== "off").map((stylist) => (
              <TouchableOpacity
                key={stylist.id}
                style={[pc.stylistRow, person.stylistId === stylist.id && pc.stylistRowSel]}
                onPress={() => selectStylist(stylist)}
              >
                <Text style={{ fontSize: 22 }}>💇</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[pc.stylistName, person.stylistId === stylist.id && { color: "#fff" }]}>
                    {stylist.name}
                  </Text>
                  <Text style={[pc.stylistStatus, person.stylistId === stylist.id && { color: "#e5e7eb" }]}>
                    {stylist.status === "available" ? "✅ Available" : "⏳ Busy"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>}

          {/* Person subtotal */}
          {hasServices && (
            <View style={pc.subtotal}>
              <Text style={pc.subtotalLabel}>{person.name}'s total</Text>
              <Text style={pc.subtotalValue}>{formatPrice(personTotal)} · {personDuration} min</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card:           { backgroundColor: "#fff", borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  header:         { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  avatar:         { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  name:           { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  servicesSummary:{ fontSize: 12, color: "#6b7280", marginTop: 2 },
  noServices:     { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  stylistTag:     { fontSize: 11, color: "#16a34a", marginTop: 2, fontWeight: "600" },
  statusDot:      { width: 10, height: 10, borderRadius: 5 },
  chevron:        { fontSize: 12, color: "#9ca3af", marginLeft: 4 },
  expanded:       { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  sectionLabel:   { fontSize: 12, fontWeight: "700", color: "#6b7280", marginTop: 12, marginBottom: 8 },
  serviceRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: "#e5e7eb", gap: 10 },
  serviceRowSel:  { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  serviceName:    { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  serviceMeta:    { fontSize: 11, color: "#6b7280", marginTop: 1 },
  servicePrice:   { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  check:          { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkSel:       { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stylistRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: "#e5e7eb", gap: 10 },
  stylistRowSel:  { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stylistName:    { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  stylistStatus:  { fontSize: 11, color: "#6b7280", marginTop: 1 },
  subtotal:       { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, marginTop: 12 },
  subtotalLabel:  { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  subtotalValue:  { fontSize: 13, color: "#16a34a", fontWeight: "700" },
});

// ── Main CheckIn Screen ───────────────────────────────────────────────────────
export default function CheckInScreen({ route, navigation }) {
  const { salon } = route.params;
  const [step,           setStep]           = useState(1);
  const [persons,        setPersons]        = useState([]);
  const [selfSelected,   setSelfSelected]   = useState(true);
  const [familyMembers,  setFamilyMembers]  = useState([]);
  const [selectedFamily, setSelectedFamily] = useState([]);
  const [loading,        setLoading]        = useState(false);

  const user = getAuth().currentUser;

  useEffect(() => {
    if (user) {
      getCustomer(user.uid).then((c) => setFamilyMembers(c?.familyMembers || []));
    }
  }, []);

  // Handle Android back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack(); return true;
    });
    return () => backHandler.remove();
  }, [step, persons]);

  const handleBack = () => {
    if (step > 1) { setStep(step - 1); return; }
    const hasSelections = persons.some((p) => (p.services || []).length > 0);
    if (hasSelections) {
      Alert.alert(
        "Cancel check-in?",
        "You'll lose your current selections.",
        [
          { text: "Keep going", style: "cancel" },
          { text: "Yes, cancel", style: "destructive", onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const buildPersons = (self, family) => {
    const list = [];
    if (self) {
      list.push({
        id:          user?.uid || "self",
        name:        user?.displayName || formatEmailName(user?.email),
        isSelf:      true,
        services:    [],
        stylistId:   null,
        stylistName: null,
      });
    }
    family.forEach((m) => {
      list.push({
        id:           m.id,
        name:         m.name,
        relationship: m.relationship,
        isSelf:       false,
        services:     [],
        stylistId:    null,
        stylistName:  null,
      });
    });
    return list;
  };

  const toggleSelf = () => {
    const newSelf = !selfSelected;
    setSelfSelected(newSelf);
    setPersons(buildPersons(newSelf, selectedFamily));
  };

  const toggleFamilyMember = (member) => {
    const newFamily = selectedFamily.find((m) => m.id === member.id)
      ? selectedFamily.filter((m) => m.id !== member.id)
      : [...selectedFamily, member];
    setSelectedFamily(newFamily);
    setPersons(buildPersons(selfSelected, newFamily));
  };

  const updatePerson = (updatedPerson) => {
    setPersons((prev) => prev.map((p) => p.id === updatedPerson.id ? updatedPerson : p));
  };

  // Totals
  const totalPrice    = persons.reduce((sum, p) => sum + (p.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0);
  const totalDuration = persons.reduce((sum, p) => sum + (p.services || []).reduce((s, sv) => s + (sv.durationMin || 0), 0), 0);
  const peopleCount   = persons.length;
  const allHaveServices = persons.length > 0 && persons.every((p) => (p.services || []).length > 0);
  const activeStylists  = (salon.stylists || []).filter((s) => s.status === "available").length || 1;
  const estimatedWait   = calcEstimatedWait((salon.queueCount || 0) + 1, persons[0]?.services || [], activeStylists);

  const hasWhoStep   = familyMembers.length > 0;
  const totalSteps   = hasWhoStep ? 3 : 2;
  const servicesStep = hasWhoStep ? 2 : 1;
  const confirmStep  = hasWhoStep ? 3 : 2;

  // Initialize persons on first render if no family members
  useEffect(() => {
    if (familyMembers.length === 0) {
      setPersons(buildPersons(true, []));
    }
  }, [familyMembers]);

  const handleCheckIn = async () => {
    if (!allHaveServices) {
      Alert.alert("Missing services", "Please select at least one service for each person.");
      return;
    }
    setLoading(true);
    try {
      const groupMembers = persons.map((p) => ({
        id:           p.id,
        name:         p.name,
        isSelf:       p.isSelf,
        relationship: p.relationship || null,
        services:     p.services,
        stylistId:    p.stylistId   || null,
        stylistName:  p.stylistName || null,
      }));

      const customerName = persons.map((p) => p.name).join(", ");

      const entryRef = await joinQueue({
        salonId:        salon.id,
        customerId:     user?.uid ?? null,
        customerName,
        services:       persons[0]?.services || [],
        stylistId:      persons[0]?.stylistId   || null,
        stylistName:    persons[0]?.stylistName || null,
        groupMembers,
        isGroupBooking: persons.length > 1,
        peopleCount:    persons.length,
        totalPrice,
      });

      await AsyncStorage.setItem("activeQueue", JSON.stringify({
        salonId: salon.id, entryId: entryRef.id, salonName: salon.name,
      }));

      navigation.reset({
        index: 0,
        routes: [{
          name: "Main",
          state: {
            routes: [
              { name: "Explore" },
              { name: "Queue", params: { salonId: salon.id, entryId: entryRef.id, salonName: salon.name } },
              { name: "Profile" },
            ],
            index: 1,
          },
        }],
      });
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const STEPS = hasWhoStep ? ["Who", "Services", "Confirm"] : ["Services", "Confirm"];

  return (
    <SafeAreaView style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={s.back}>{step > 1 ? "← Back" : "← Cancel"}</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{salon.name}</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Step indicator */}
      <View style={s.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={s.stepItem}>
            <View style={[s.stepCircle, step > i + 1 && s.stepDone, step === i + 1 && s.stepActive]}>
              <Text style={[s.stepNum, (step > i + 1 || step === i + 1) && { color: "#fff" }]}>{i + 1}</Text>
            </View>
            <Text style={[s.stepLabel, step === i + 1 && { color: "#1a1a2e", fontWeight: "600" }]}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── Step 1: Who ── */}
        {step === 1 && hasWhoStep && <>
          <Text style={s.sectionTitle}>Who is checking in?</Text>
          <Text style={s.sectionSub}>Select everyone joining today</Text>

          <TouchableOpacity style={[s.whoCard, selfSelected && s.whoCardSel]} onPress={toggleSelf}>
            <View style={s.whoAvatar}><Text style={{ fontSize: 26 }}>😊</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.whoName, selfSelected && { color: "#fff" }]}>
                {user?.displayName || formatEmailName(user?.email)}
              </Text>
              <Text style={[s.whoSub, selfSelected && { color: "#e5e7eb" }]}>Myself</Text>
            </View>
            <View style={[s.checkCircle, selfSelected && s.checkCircleSel]}>
              {selfSelected && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
            </View>
          </TouchableOpacity>

          {familyMembers.map((member) => {
            const selected = !!selectedFamily.find((m) => m.id === member.id);
            return (
              <TouchableOpacity key={member.id} style={[s.whoCard, selected && s.whoCardSel]} onPress={() => toggleFamilyMember(member)}>
                <View style={s.whoAvatar}>
                  <Text style={{ fontSize: 26 }}>{RELATIONSHIP_EMOJI[member.relationship] || "👤"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.whoName, selected && { color: "#fff" }]}>{member.name}</Text>
                  <Text style={[s.whoSub, selected && { color: "#e5e7eb" }]}>{member.relationship}</Text>
                </View>
                <View style={[s.checkCircle, selected && s.checkCircleSel]}>
                  {selected && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}

          {persons.length > 0 && (
            <View style={s.selectionNote}>
              <Text style={s.selectionNoteText}>
                ✅ {persons.length} person{persons.length > 1 ? "s" : ""} selected: {persons.map((p) => p.name).join(", ")}
              </Text>
            </View>
          )}
        </>}

        {/* ── Step 2: Services per person ── */}
        {step === servicesStep && <>
          <Text style={s.sectionTitle}>
            {persons.length > 1 ? "Services for each person" : "Choose services"}
          </Text>
          <Text style={s.sectionSub}>
            {persons.length > 1
              ? "Tap each person to pick their services and stylist"
              : "Select your services and preferred stylist"
            }
          </Text>

          {persons.map((person) => (
            <PersonCard key={person.id} person={person} salon={salon} onUpdate={updatePerson} />
          ))}

          <View style={s.progressCard}>
            {persons.map((p) => {
              const done = (p.services || []).length > 0;
              return (
                <View key={p.id} style={s.progressRow}>
                  <Text style={[s.progressDot, { color: done ? "#16a34a" : "#e5e7eb" }]}>●</Text>
                  <Text style={[s.progressName, done && { color: "#16a34a" }]}>{p.name}</Text>
                  <Text style={s.progressServices}>
                    {done ? (p.services || []).map((sv) => sv.name).join(", ") : "No services selected"}
                  </Text>
                </View>
              );
            })}
          </View>
        </>}

        {/* ── Step 3: Confirm ── */}
        {step === confirmStep && <>
          <Text style={s.sectionTitle}>Confirm booking</Text>
          <View style={s.confirmCard}>
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Salon</Text>
              <Text style={s.confirmValue}>{salon.name}</Text>
            </View>
            <View style={s.divider} />

            {persons.map((person, i) => (
              <View key={person.id}>
                <View style={s.personConfirmHeader}>
                  <Text style={{ fontSize: 16 }}>
                    {person.isSelf ? "😊" : (RELATIONSHIP_EMOJI[person.relationship] || "👤")}
                  </Text>
                  <Text style={s.personConfirmName}>{person.name}</Text>
                  <Text style={s.personConfirmTotal}>
                    {formatPrice((person.services || []).reduce((s, sv) => s + (sv.price || 0), 0))}
                  </Text>
                </View>
                <Text style={s.personConfirmServices}>
                  {(person.services || []).map((sv) => sv.name).join(", ")}
                </Text>
                <Text style={s.personConfirmStylist}>
                  💇 {person.stylistName || "Any available stylist"}
                </Text>
                {i < persons.length - 1 && <View style={s.divider} />}
              </View>
            ))}

            <View style={s.divider} />
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Est. wait</Text>
              <Text style={[s.confirmValue, { color: "#d97706", fontWeight: "700" }]}>
                {formatWait(estimatedWait)}
              </Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Duration</Text>
              <Text style={s.confirmValue}>~{totalDuration} min</Text>
            </View>
            <View style={s.divider} />
            <View style={s.confirmRow}>
              <Text style={[s.confirmLabel, { fontSize: 16, fontWeight: "800", color: "#1a1a2e" }]}>Total</Text>
              <Text style={[s.confirmValue, { fontSize: 18, fontWeight: "900", color: "#1a1a2e" }]}>
                {formatPrice(totalPrice)}
              </Text>
            </View>
          </View>

          <View style={s.notifNote}>
            <Text style={s.notifNoteText}>
              🔔 You'll receive a push notification when your group is being called.
            </Text>
          </View>
        </>}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {step === servicesStep && totalPrice > 0 && (
          <Text style={s.footerMeta}>
            {peopleCount > 1 ? `${peopleCount} people · ` : ""}
            {formatPrice(totalPrice)} · {totalDuration} min
          </Text>
        )}
        <TouchableOpacity
          style={[
            s.nextBtn,
            ((step === 1 && hasWhoStep && persons.length === 0) ||
             (step === servicesStep && !allHaveServices)) && { opacity: 0.4 },
          ]}
          onPress={() => {
            if (step === 1 && hasWhoStep && persons.length === 0) {
              Alert.alert("Select who is checking in"); return;
            }
            if (step === servicesStep && !allHaveServices) {
              Alert.alert("Missing services", "Please select at least one service for each person."); return;
            }
            if (step < totalSteps) setStep(step + 1);
            else handleCheckIn();
          }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.nextBtnText}>{step === totalSteps ? "✅ Join Queue" : "Next →"}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:           { flex: 1, backgroundColor: "#fafafa" },
  topBar:              { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:                { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 70 },
  topTitle:            { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  steps:               { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stepItem:            { alignItems: "center", gap: 4 },
  stepCircle:          { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  stepActive:          { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stepDone:            { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepNum:             { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stepLabel:           { fontSize: 10, color: "#9ca3af" },
  content:             { padding: 16, paddingBottom: 120 },
  sectionTitle:        { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 4 },
  sectionSub:          { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  whoCard:             { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#e5e7eb" },
  whoCardSel:          { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  whoAvatar:           { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  whoName:             { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  whoSub:              { fontSize: 12, color: "#6b7280", marginTop: 2 },
  checkCircle:         { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkCircleSel:      { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  selectionNote:       { backgroundColor: "#dcfce7", borderRadius: 12, padding: 12, marginTop: 4 },
  selectionNoteText:   { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  progressCard:        { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  progressRow:         { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  progressDot:         { fontSize: 12 },
  progressName:        { fontSize: 13, fontWeight: "700", color: "#6b7280", width: 70 },
  progressServices:    { fontSize: 12, color: "#9ca3af", flex: 1 },
  confirmCard:         { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  confirmRow:          { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  confirmLabel:        { fontSize: 14, color: "#6b7280" },
  confirmValue:        { fontSize: 14, color: "#1a1a2e", fontWeight: "500", flex: 1, textAlign: "right" },
  personConfirmHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  personConfirmName:   { flex: 1, fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  personConfirmTotal:  { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  personConfirmServices:{ fontSize: 12, color: "#6b7280", paddingLeft: 28, marginBottom: 2 },
  personConfirmStylist: { fontSize: 12, color: "#9ca3af", paddingLeft: 28, marginBottom: 8 },
  divider:             { height: 1, backgroundColor: "#f3f4f6", marginVertical: 4 },
  notifNote:           { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginTop: 12 },
  notifNoteText:       { fontSize: 13, color: "#1d4ed8", lineHeight: 18 },
  footer:              { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 16 },
  footerMeta:          { textAlign: "center", color: "#6b7280", fontSize: 13, marginBottom: 8 },
  nextBtn:             { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextBtnText:         { color: "#fff", fontSize: 16, fontWeight: "800" },
});
