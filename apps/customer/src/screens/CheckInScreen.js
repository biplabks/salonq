// apps/customer/src/screens/CheckInScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, BackHandler, Platform,
} from "react-native";
import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinQueue, getCustomer } from "../firebase";
import { formatPrice, formatWait, calcEstimatedWait } from "../utils";
import {
  registerForPushNotifications,
  savePushToken,
} from "../services/notifications";

const RELATIONSHIP_EMOJI = {
  Spouse: "💑", Child: "👶", Parent: "👨‍👩‍👦",
  Sibling: "👫", Grandparent: "👴", Grandchild: "🧒",
  Friend: "👥", Other: "👤",
};

export default function CheckInScreen({ route, navigation }) {
  const { salon } = route.params;
  const [selectedServices,  setSelectedServices]  = useState([]);
  const [selectedStylist,   setSelectedStylist]   = useState(null);
  const [selectedMembers,   setSelectedMembers]   = useState([]); // family members to check in
  const [checkingInSelf,    setCheckingInSelf]    = useState(true);
  const [familyMembers,     setFamilyMembers]     = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [step,              setStep]              = useState(1); // 1=who, 2=services, 3=stylist, 4=confirm

  const user = getAuth().currentUser;

  // Load family members
  useEffect(() => {
    if (user) {
      getCustomer(user.uid).then((c) => {
        setFamilyMembers(c?.familyMembers || []);
      });
    }
  }, []);

  // Android back button — confirm before cancelling
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      const hasSelections = selectedServices.length > 0 || selectedMembers.length > 0;
      if (step === 1 && hasSelections) {
        Alert.alert(
          "Cancel check-in?",
          "You have unsaved selections. Are you sure you want to go back?",
          [
            { text: "Stay", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => navigation.goBack() },
          ]
        );
        return true; // prevent default back
      }
      if (step > 1) {
        setStep(step - 1);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [step, selectedServices, selectedMembers]);

  const toggleService = (service) =>
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );

  const toggleMember = (member) => {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === member.id)
        ? prev.filter((m) => m.id !== member.id)
        : [...prev, member]
    );
  };

  // Who is checking in
  const checkInNames = [
    ...(checkingInSelf ? ["Myself"] : []),
    ...selectedMembers.map((m) => m.name),
  ];

  const totalPrice    = selectedServices.reduce((s, sv) => s + sv.price, 0);
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.durationMin, 0);
  const activeStylists = (salon.stylists || []).filter((s) => s.status === "available").length || 1;
  const estimatedWait  = calcEstimatedWait((salon.queueCount || 0) + 1, selectedServices, activeStylists);

  // Number of people checking in
  const peopleCount = (checkingInSelf ? 1 : 0) + selectedMembers.length;

  const handleCheckIn = async () => {
    if (peopleCount === 0) { Alert.alert("Select who is checking in"); return; }
    if (!selectedServices.length) { Alert.alert("Select a service"); return; }

    setLoading(true);
    try {
      const pushToken = await registerForPushNotifications();

      // Build customer name string
      const customerName = checkInNames.join(", ");

      const entryRef = await joinQueue({
        salonId:       salon.id,
        customerId:    user?.uid ?? null,
        customerName,
        services:      selectedServices,
        stylistId:     selectedStylist?.id ?? null,
        familyMembers: selectedMembers,
        checkingInSelf,
        peopleCount,
      });

      if (pushToken) await savePushToken(salon.id, entryRef.id, pushToken);

      const activeQueue = {
        salonId:   salon.id,
        entryId:   entryRef.id,
        salonName: salon.name,
      };
      await AsyncStorage.setItem("activeQueue", JSON.stringify(activeQueue));

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

  const steps = familyMembers.length > 0
    ? ["Who", "Services", "Stylist", "Confirm"]
    : ["Services", "Stylist", "Confirm"];
  const totalSteps = steps.length;

  // Adjust step numbering based on whether "Who" step exists
  const hasWhoStep = familyMembers.length > 0;
  const serviceStep  = hasWhoStep ? 2 : 1;
  const stylistStep  = hasWhoStep ? 3 : 2;
  const confirmStep  = hasWhoStep ? 4 : 3;

  return (
    <SafeAreaView style={s.container}>
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
        {steps.map((label, i) => (
          <View key={label} style={s.stepItem}>
            <View style={[
              s.stepCircle,
              step > i + 1 && s.stepDone,
              step === i + 1 && s.stepActive,
            ]}>
              <Text style={[s.stepNum, (step > i + 1 || step === i + 1) && { color: "#fff" }]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[s.stepLabel, step === i + 1 && { color: "#1a1a2e", fontWeight: "600" }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── Step 1: Who is checking in? (only if family members exist) ── */}
        {step === 1 && hasWhoStep && <>
          <Text style={s.sectionTitle}>Who is checking in?</Text>
          <Text style={s.sectionSub}>Select everyone who needs a service today</Text>

          {/* Myself */}
          <TouchableOpacity
            style={[s.whoCard, checkingInSelf && s.whoCardSel]}
            onPress={() => setCheckingInSelf(!checkingInSelf)}
          >
            <View style={s.whoAvatar}>
              <Text style={{ fontSize: 26 }}>😊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.whoName, checkingInSelf && { color: "#fff" }]}>Myself</Text>
              <Text style={[s.whoRel, checkingInSelf && { color: "#e5e7eb" }]}>
                {user?.displayName || user?.email || "You"}
              </Text>
            </View>
            <View style={[s.checkCircle, checkingInSelf && s.checkCircleSel]}>
              {checkingInSelf && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
            </View>
          </TouchableOpacity>

          {/* Family members */}
          {familyMembers.map((member) => {
            const selected = !!selectedMembers.find((m) => m.id === member.id);
            return (
              <TouchableOpacity
                key={member.id}
                style={[s.whoCard, selected && s.whoCardSel]}
                onPress={() => toggleMember(member)}
              >
                <View style={s.whoAvatar}>
                  <Text style={{ fontSize: 26 }}>
                    {RELATIONSHIP_EMOJI[member.relationship] || "👤"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.whoName, selected && { color: "#fff" }]}>{member.name}</Text>
                  <Text style={[s.whoRel, selected && { color: "#e5e7eb" }]}>{member.relationship}</Text>
                </View>
                <View style={[s.checkCircle, selected && s.checkCircleSel]}>
                  {selected && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}

          {peopleCount > 0 && (
            <View style={s.selectionNote}>
              <Text style={s.selectionNoteText}>
                ✅ {peopleCount} person{peopleCount > 1 ? "s" : ""} selected: {checkInNames.join(", ")}
              </Text>
            </View>
          )}
        </>}

        {/* ── Services step ── */}
        {step === serviceStep && <>
          <Text style={s.sectionTitle}>Choose services</Text>
          {peopleCount > 1 && (
            <View style={s.groupNote}>
              <Text style={s.groupNoteText}>
                👨‍👩‍👧 Checking in {peopleCount} people — select services for the group
              </Text>
            </View>
          )}
          {(salon.services || []).map((service) => {
            const selected = !!selectedServices.find((sv) => sv.id === service.id);
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
                  <View style={[s.checkCircle, selected && s.checkCircleSel]}>
                    {selected && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </>}

        {/* ── Stylist step ── */}
        {step === stylistStep && <>
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

        {/* ── Confirm step ── */}
        {step === confirmStep && <>
          <Text style={s.sectionTitle}>Confirm check-in</Text>
          <View style={s.confirmCard}>
            {[
              ["Salon",       salon.name],
              ["Checking in", checkInNames.join(", ")],
              ["Services",    selectedServices.map((sv) => sv.name).join(", ")],
              ["Stylist",     selectedStylist?.name || "Any available"],
              ["Duration",    `~${totalDuration} min`],
              ["Est. wait",   formatWait(estimatedWait), "#d97706"],
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
          <View style={s.notifNote}>
            <Text style={s.notifNoteText}>
              🔔 You'll receive push notifications when your turn is coming up.
            </Text>
          </View>
        </>}

      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {selectedServices.length > 0 && (
          <Text style={s.footerMeta}>
            {peopleCount > 1 ? `${peopleCount} people · ` : ""}
            {selectedServices.length} service(s) · {formatPrice(totalPrice)} · {totalDuration} min
          </Text>
        )}
        <TouchableOpacity
          style={[
            s.nextBtn,
            ((step === 1 && hasWhoStep && peopleCount === 0) ||
             (step === serviceStep && !selectedServices.length)) && { opacity: 0.4 },
          ]}
          onPress={() => {
            if (step === 1 && hasWhoStep && peopleCount === 0) {
              Alert.alert("Select who is checking in");
              return;
            }
            if (step === serviceStep && !selectedServices.length) {
              Alert.alert("Select a service");
              return;
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
  container:      { flex: 1, backgroundColor: "#fafafa" },
  topBar:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:           { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 70 },
  topTitle:       { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  steps:          { flexDirection: "row", justifyContent: "center", gap: 20, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stepItem:       { alignItems: "center", gap: 4 },
  stepCircle:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  stepActive:     { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stepDone:       { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepNum:        { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stepLabel:      { fontSize: 10, color: "#9ca3af" },
  content:        { padding: 20, paddingBottom: 140 },
  sectionTitle:   { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  sectionSub:     { fontSize: 13, color: "#6b7280", marginBottom: 16 },

  // Who step
  whoCard:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#e5e7eb" },
  whoCardSel:     { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  whoAvatar:      { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  whoName:        { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  whoRel:         { fontSize: 12, color: "#6b7280", marginTop: 2 },
  checkCircle:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkCircleSel: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  selectionNote:  { backgroundColor: "#dcfce7", borderRadius: 12, padding: 12, marginTop: 8 },
  selectionNoteText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  groupNote:      { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, marginBottom: 16 },
  groupNoteText:  { fontSize: 13, color: "#1d4ed8" },

  // Services
  serviceCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  serviceCardSel: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  serviceName:    { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  serviceMeta:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  serviceRight:   { alignItems: "flex-end", gap: 6 },
  servicePrice:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },

  // Stylist
  stylistCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: "#e5e7eb" },
  stylistCardSel: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  stylistName:    { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistStatus:  { fontSize: 12, color: "#6b7280", marginTop: 2 },

  // Confirm
  confirmCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  confirmRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  confirmLabel:   { fontSize: 14, color: "#6b7280" },
  confirmValue:   { fontSize: 14, color: "#1a1a2e", fontWeight: "500", flex: 1, textAlign: "right" },
  divider:        { height: 1, backgroundColor: "#f3f4f6", marginVertical: 4 },
  notifNote:      { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginTop: 16 },
  notifNoteText:  { fontSize: 13, color: "#1d4ed8", lineHeight: 18 },

  // Footer
  footer:         { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 16 },
  footerMeta:     { textAlign: "center", color: "#6b7280", fontSize: 13, marginBottom: 8 },
  nextBtn:        { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextBtnText:    { color: "#fff", fontSize: 16, fontWeight: "800" },
});
