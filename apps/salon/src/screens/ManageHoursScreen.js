// apps/salon/src/screens/ManageHoursScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Switch, ActivityIndicator,
} from "react-native";
import { saveSalon } from "../firebase";
import { crossAlert, crossAlertInfo } from "../utils/crossAlert";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const DEFAULT_HOURS = {
  open: "09:00", close: "19:00", closed: false,
};

// Preset time options
const TIME_OPTIONS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

export default function ManageHoursScreen({ salon, salonId, onBack }) {
  const [hours,    setHours]    = useState(
    salon?.hours || DAYS.reduce((acc, d) => ({ ...acc, [d]: { ...DEFAULT_HOURS } }), {})
  );
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null); // which day is expanded

  const toggleDay = (day) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed },
    }));
  };

  const setTime = (day, field, value) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveSalon(salonId, { hours });
      crossAlertInfo("Saved! ✅", "Opening hours updated successfully.");
    } catch (err) {
      crossAlertInfo("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy hours from one day to all weekdays
  const copyToWeekdays = (day) => {
    const h = hours[day];
    const apply = () => {
      const weekdays = ["mon", "tue", "wed", "thu", "fri"];
      setHours((prev) => {
        const updated = { ...prev };
        weekdays.forEach((d) => { updated[d] = { ...h }; });
        return updated;
      });
    };
    crossAlert(
      "Copy to weekdays?",
      `Apply ${DAY_LABELS[day]}'s hours to Mon–Fri?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes", onPress: apply },
      ]
    );
  };

  const today = DAYS[["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(
    ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()]
  )];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Opening Hours</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.hint}>Tap a day to set opening and closing times.</Text>

        {DAYS.map((day) => {
          const h        = hours[day] || DEFAULT_HOURS;
          const isToday  = day === today;
          const isOpen   = expanded === day;

          return (
            <View key={day} style={[s.card, isToday && s.cardToday]}>
              {/* Day row */}
              <TouchableOpacity
                style={s.dayRow}
                onPress={() => setExpanded(isOpen ? null : day)}
              >
                <View style={s.dayLeft}>
                  <Text style={[s.dayName, isToday && s.dayNameToday]}>
                    {DAY_LABELS[day]} {isToday ? "📍" : ""}
                  </Text>
                  {!h.closed && (
                    <Text style={s.dayHours}>{h.open} – {h.close}</Text>
                  )}
                </View>
                <View style={s.dayRight}>
                  <Text style={[s.dayStatus, { color: h.closed ? "#9ca3af" : "#16a34a" }]}>
                    {h.closed ? "Closed" : "Open"}
                  </Text>
                  <Switch
                    value={!h.closed}
                    onValueChange={() => toggleDay(day)}
                    trackColor={{ false: "#e5e7eb", true: "#bbf7d0" }}
                    thumbColor={!h.closed ? "#16a34a" : "#9ca3af"}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded time picker */}
              {isOpen && !h.closed && (
                <View style={s.timePicker}>
                  <View style={s.timeRow}>
                    <Text style={s.timeLabel}>Opens at</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.timeOptions}>
                        {TIME_OPTIONS.map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[s.timeBtn, h.open === t && s.timeBtnSel]}
                            onPress={() => setTime(day, "open", t)}
                          >
                            <Text style={[s.timeBtnText, h.open === t && s.timeBtnTextSel]}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  <View style={s.timeRow}>
                    <Text style={s.timeLabel}>Closes at</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.timeOptions}>
                        {TIME_OPTIONS.map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[s.timeBtn, h.close === t && s.timeBtnSel]}
                            onPress={() => setTime(day, "close", t)}
                          >
                            <Text style={[s.timeBtnText, h.close === t && s.timeBtnTextSel]}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  <TouchableOpacity style={s.copyBtn} onPress={() => copyToWeekdays(day)}>
                    <Text style={s.copyBtnText}>Copy to all weekdays</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Save Hours</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fafafa" },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:            { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:           { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  content:         { padding: 16 },
  hint:            { fontSize: 13, color: "#9ca3af", marginBottom: 16, textAlign: "center" },
  card:            { backgroundColor: "#fff", borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  cardToday:       { borderColor: "#1a1a2e", borderWidth: 1.5 },
  dayRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  dayLeft:         { flex: 1 },
  dayName:         { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  dayNameToday:    { fontWeight: "800" },
  dayHours:        { fontSize: 12, color: "#6b7280", marginTop: 2 },
  dayRight:        { flexDirection: "row", alignItems: "center", gap: 10 },
  dayStatus:       { fontSize: 12, fontWeight: "600" },
  timePicker:      { borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 16, backgroundColor: "#fafafa" },
  timeRow:         { marginBottom: 14 },
  timeLabel:       { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 8 },
  timeOptions:     { flexDirection: "row", gap: 6 },
  timeBtn:         { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  timeBtnSel:      { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  timeBtnText:     { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  timeBtnTextSel:  { color: "#fff", fontWeight: "600" },
  copyBtn:         { alignItems: "center", paddingVertical: 8 },
  copyBtnText:     { fontSize: 13, color: "#1a1a2e", fontWeight: "600" },
  saveBtn:         { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  saveBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
});
