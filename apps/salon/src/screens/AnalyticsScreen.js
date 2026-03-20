// apps/salon/src/screens/AnalyticsScreen.js
// Full historical analytics with custom date range picker

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import {
  collection, getDocs, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";

const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const formatCurrency   = (amount) => `৳${Number(amount || 0).toLocaleString()}`;
const formatWait       = (min) => !min || min <= 0 ? "0 min" : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

const formatDateLabel = (date) =>
  date.toLocaleDateString([], { day: "numeric", month: "short" });

const formatDateFull = (date) =>
  date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

// ── Quick range presets ───────────────────────────────────────────────────────
const PRESETS = [
  {
    label: "Today",
    getRange: () => {
      const start = new Date(); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      return { start, end };
    },
  },
  {
    label: "This week",
    getRange: () => {
      const now = new Date(), day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      return { start, end };
    },
  },
  {
    label: "Last 7 days",
    getRange: () => {
      const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      return { start, end };
    },
  },
  {
    label: "Last 30 days",
    getRange: () => {
      const start = new Date(); start.setDate(start.getDate() - 29); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      return { start, end };
    },
  },
  {
    label: "Last 3 months",
    getRange: () => {
      const start = new Date(); start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      return { start, end };
    },
  },
  {
    label: "Custom",
    getRange: null, // handled manually
  },
];

// ── Inline calendar (no modal) ────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function InlineCalendar({ selected, onSelect, minDate, maxDate }) {
  const [viewDate, setViewDate] = useState(selected || new Date());
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={cal.container}>
      {/* Month nav */}
      <View style={cal.monthNav}>
        <TouchableOpacity style={cal.navBtn} onPress={() => setViewDate(new Date(year, month - 1, 1))}>
          <Text style={cal.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={() => setViewDate(new Date(year, month + 1, 1))}>
          <Text style={cal.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={cal.weekRow}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d, i) => (
          <Text key={i} style={cal.weekLabel}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={cal.cell} />;
          const cellDate = new Date(year, month, day);
          cellDate.setHours(0, 0, 0, 0);
          const isSelected = selected && cellDate.toDateString() === selected.toDateString();
          const isDisabled = (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate);
          const isToday    = cellDate.toDateString() === new Date().toDateString();
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, isSelected && cal.cellSel, isToday && !isSelected && cal.cellToday, isDisabled && cal.cellOff]}
              onPress={() => !isDisabled && onSelect(new Date(year, month, day))}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <Text style={[cal.cellText, isSelected && cal.cellTextSel, isToday && !isSelected && cal.cellTextToday, isDisabled && cal.cellTextOff]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Analytics Screen ─────────────────────────────────────────────────────
export default function AnalyticsScreen({ salonId, salon }) {
  const [loading,          setLoading]         = useState(false);
  const [activePreset,  setActivePreset]  = useState("Last 7 days");
  const [startDate,     setStartDate]     = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; });
  const [endDate,       setEndDate]       = useState(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [activePicker,  setActivePicker]  = useState(null); // "start" | "end" | null

  // Results
  const [summary,          setSummary]          = useState(null);
  const [dailyChart,       setDailyChart]       = useState([]);
  const [topServices,      setTopServices]      = useState([]);
  const [stylistStats,     setStylistStats]     = useState([]);
  const [lastFetched,      setLastFetched]      = useState(null);

  useEffect(() => { if (salonId) fetchAnalytics(); }, [salonId, startDate, endDate]);

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    if (preset.getRange) {
      const { start, end } = preset.getRange();
      setStartDate(start);
      setEndDate(end);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(firestore, "salons", salonId, "queue"),
          where("joinedAt", ">=", Timestamp.fromDate(startDate)),
          where("joinedAt", "<=", Timestamp.fromDate(endDate)),
          orderBy("joinedAt", "asc")
        )
      );
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ── Summary stats ──────────────────────────────────────────────────────
      const done    = entries.filter((e) => e.status === "done");
      const noShows = entries.filter((e) => e.status === "no-show");
      const revenue = done.reduce((sum, e) =>
        sum + (e.totalAfterDiscount || (e.services || []).reduce((s, sv) => s + (sv.price || 0), 0)), 0
      );

      const waits = done
        .filter((e) => e.joinedAt && e.calledAt)
        .map((e) => {
          const j = toDate(e.joinedAt), c = toDate(e.calledAt);
          return (!j || !c) ? 0 : Math.max(0, (c - j) / 60000);
        })
        .filter((w) => w > 0);
      const avgWait = waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : 0;

      setSummary({
        customers: done.length,
        revenue,
        avgWait,
        noShows:   noShows.length,
        total:     entries.length,
      });

      // ── Daily chart ────────────────────────────────────────────────────────
      const dayMap = {};
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const key = cursor.toDateString();
        dayMap[key] = { date: new Date(cursor), customers: 0, revenue: 0 };
        cursor.setDate(cursor.getDate() + 1);
      }

      done.forEach((e) => {
        const j = toDate(e.joinedAt);
        if (!j) return;
        const key = j.toDateString();
        if (dayMap[key]) {
          dayMap[key].customers++;
          dayMap[key].revenue += e.totalAfterDiscount
            || (e.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
        }
      });

      const chartData = Object.values(dayMap);
      setDailyChart(chartData);

      // ── Top services ───────────────────────────────────────────────────────
      const serviceMap = {};
      done.forEach((e) => {
        (e.services || []).forEach((sv) => {
          if (!serviceMap[sv.name]) serviceMap[sv.name] = { name: sv.name, count: 0, revenue: 0 };
          serviceMap[sv.name].count++;
          serviceMap[sv.name].revenue += sv.price || 0;
        });
      });
      setTopServices(Object.values(serviceMap).sort((a, b) => b.count - a.count).slice(0, 5));

      // ── Stylist stats ──────────────────────────────────────────────────────
      const stylistMap = {};
      done.forEach((e) => {
        if (!e.stylistId) return;
        const stylist = (salon?.stylists || []).find((s) => s.id === e.stylistId);
        if (!stylistMap[e.stylistId]) {
          stylistMap[e.stylistId] = {
            id:      e.stylistId,
            name:    stylist?.name || "Unknown",
            count:   0,
            revenue: 0,
          };
        }
        stylistMap[e.stylistId].count++;
        stylistMap[e.stylistId].revenue += e.totalAfterDiscount
          || (e.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
      });
      setStylistStats(Object.values(stylistMap).sort((a, b) => b.count - a.count));
      setLastFetched(new Date());

    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  const maxCustomers = Math.max(...dailyChart.map((d) => d.customers), 1);
  const maxRevenue   = Math.max(...topServices.map((s) => s.revenue), 1);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Analytics</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={fetchAnalytics}>
          <Text style={s.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Preset pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presetScroll} contentContainerStyle={s.presets}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={[s.presetPill, activePreset === preset.label && s.presetPillActive]}
              onPress={() => {
                if (preset.label === "Custom") {
                  setActivePreset("Custom");
                } else {
                  applyPreset(preset);
                }
              }}
            >
              <Text style={[s.presetText, activePreset === preset.label && s.presetTextActive]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Custom date range picker ── */}
        {activePreset === "Custom" && (
          <View style={s.dateRangeCard}>
            {/* From / To buttons */}
            <View style={s.dateRow}>
              <TouchableOpacity
                style={[s.datePicker, activePicker === "start" && s.datePickerActive]}
                onPress={() => setActivePicker(activePicker === "start" ? null : "start")}
              >
                <Text style={s.datePickerLabel}>FROM</Text>
                <Text style={s.datePickerValue}>{formatDateFull(startDate)}</Text>
              </TouchableOpacity>
              <Text style={s.dateSeparator}>→</Text>
              <TouchableOpacity
                style={[s.datePicker, activePicker === "end" && s.datePickerActive]}
                onPress={() => setActivePicker(activePicker === "end" ? null : "end")}
              >
                <Text style={s.datePickerLabel}>TO</Text>
                <Text style={s.datePickerValue}>{formatDateFull(endDate)}</Text>
              </TouchableOpacity>
            </View>

            {/* Inline calendar */}
            {activePicker === "start" && (
              <InlineCalendar
                selected={startDate}
                maxDate={endDate}
                onSelect={(d) => { d.setHours(0,0,0,0); setStartDate(d); setActivePicker(null); }}
              />
            )}
            {activePicker === "end" && (
              <InlineCalendar
                selected={endDate}
                minDate={startDate}
                maxDate={new Date()}
                onSelect={(d) => { d.setHours(23,59,59,999); setEndDate(d); setActivePicker(null); }}
              />
            )}

            {!activePicker && (
              <TouchableOpacity style={s.applyBtn} onPress={fetchAnalytics}>
                <Text style={s.applyBtnText}>Apply Range</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Date range display */}
        <Text style={s.rangeLabel}>
          {formatDateFull(startDate)} — {formatDateFull(endDate)}
          {lastFetched && ` · Updated ${lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </Text>

        {loading ? (
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color="#1a1a2e" />
            <Text style={s.loadingText}>Fetching analytics…</Text>
          </View>
        ) : <>

          {/* ── Summary cards ── */}
          <Text style={s.sectionTitle}>📊 Summary</Text>
          <View style={s.statsGrid}>
            <StatCard label="Customers served" value={summary?.customers || 0}              color="#1a1a2e" />
            <StatCard label="Revenue"           value={formatCurrency(summary?.revenue || 0)} color="#16a34a" small />
            <StatCard label="Avg wait"          value={formatWait(summary?.avgWait || 0)}    color="#d97706" small />
            <StatCard label="No-shows"          value={summary?.noShows || 0}                color="#ef4444" />
          </View>

          {/* ── Daily customers chart ── */}
          <Text style={s.sectionTitle}>📈 Daily Customers</Text>
          <View style={s.chartCard}>
            {dailyChart.length === 0 ? (
              <Text style={s.empty}>No data for this period.</Text>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.barScroll}
                >
                  {dailyChart.map((day, i) => {
                    const barH    = (day.customers / maxCustomers) * 100;
                    const isToday = day.date.toDateString() === new Date().toDateString();
                    return (
                      <View key={i} style={s.barCol}>
                        <Text style={s.barCount}>
                          {day.customers > 0 ? day.customers : ""}
                        </Text>
                        <View style={s.barTrack}>
                          <View style={[
                            s.barFill,
                            { height: Math.max(barH, day.customers > 0 ? 6 : 0) },
                            isToday && s.barFillToday,
                          ]} />
                        </View>
                        <Text style={[s.barDateLabel, isToday && s.barDateLabelToday]}>
                          {formatDateLabel(day.date)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={s.chartFooter}>
                  <Text style={s.chartNote}>
                    {summary?.customers || 0} customers · {formatCurrency(summary?.revenue || 0)} revenue
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── Top services ── */}
          <Text style={s.sectionTitle}>⭐ Top Services</Text>
          <View style={s.listCard}>
            {topServices.length === 0
              ? <Text style={s.empty}>No completed services in this period.</Text>
              : topServices.map((item, i) => (
                <View key={i} style={s.serviceRow}>
                  <View style={s.serviceRowLeft}>
                    <View style={s.serviceRankRow}>
                      <View style={[s.rank, { backgroundColor: i === 0 ? "#fef9c3" : i === 1 ? "#f3f4f6" : "#fff7ed" }]}>
                        <Text style={s.rankText}>#{i + 1}</Text>
                      </View>
                      <Text style={s.serviceRowName}>{item.name}</Text>
                    </View>
                    <View style={s.revenueBarBg}>
                      <View style={[s.revenueBarFill, { width: `${Math.round((item.revenue / maxRevenue) * 100)}%` }]} />
                    </View>
                  </View>
                  <View style={s.serviceRowRight}>
                    <Text style={s.serviceRowRevenue}>{formatCurrency(item.revenue)}</Text>
                    <Text style={s.serviceRowCount}>{item.count}x</Text>
                  </View>
                </View>
              ))
            }
          </View>

          {/* ── Stylist performance ── */}
          <Text style={s.sectionTitle}>👥 Stylist Performance</Text>
          <View style={s.listCard}>
            {stylistStats.length === 0
              ? <Text style={s.empty}>No stylist-assigned services in this period.</Text>
              : stylistStats.map((stylist, i) => (
                <View key={i} style={s.stylistRow}>
                  <View style={s.stylistRank}>
                    <Text style={s.stylistRankText}>#{i + 1}</Text>
                  </View>
                  <View style={s.stylistAvatar}><Text style={{ fontSize: 20 }}>💇</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.stylistName}>{stylist.name}</Text>
                    <Text style={s.stylistMeta}>{stylist.count} customer{stylist.count !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={s.stylistRevenue}>{formatCurrency(stylist.revenue)}</Text>
                </View>
              ))
            }
          </View>

        </>}

      </ScrollView>

    </SafeAreaView>
  );
}

const StatCard = ({ label, value, color, small }) => (
  <View style={s.statCard}>
    <Text style={[s.statValue, { color }, small && { fontSize: 18 }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:            { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  refreshBtn:       { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText:      { fontSize: 18, color: "#1a1a2e", fontWeight: "600" },
  content:          { padding: 16, paddingBottom: 40 },
  presetScroll:     { marginBottom: 12 },
  presets:          { flexDirection: "row", gap: 8, paddingVertical: 4 },
  presetPill:       { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: "#e5e7eb" },
  presetPillActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  presetText:       { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  presetTextActive: { color: "#fff" },
  dateRangeCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  dateRangeTitle:   { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 12 },
  dateRow:          { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  datePicker:       { flex: 1, backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: "#e5e7eb" },
  datePickerActive: { borderColor: "#1a1a2e", backgroundColor: "#fff" },
  datePickerLabel:  { fontSize: 11, color: "#9ca3af", fontWeight: "600", marginBottom: 2 },
  datePickerValue:  { fontSize: 13, color: "#1a1a2e", fontWeight: "700" },
  dateSeparator:    { fontSize: 16, color: "#9ca3af" },
  applyBtn:         { backgroundColor: "#1a1a2e", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  applyBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  rangeLabel:       { fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 8 },
  loadingCard:      { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText:      { fontSize: 14, color: "#6b7280" },
  sectionTitle:     { fontSize: 15, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 10 },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:         { backgroundColor: "#fff", borderRadius: 14, padding: 16, flex: 1, minWidth: "45%", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  statValue:        { fontSize: 26, fontWeight: "900" },
  statLabel:        { fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "center" },
  chartCard:        { backgroundColor: "#fff", borderRadius: 16, paddingTop: 16, paddingHorizontal: 0, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  barScroll:        { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingBottom: 4 },
  barCol:           { alignItems: "center", width: 48, marginHorizontal: 3 },
  barCount:         { fontSize: 12, fontWeight: "700", color: "#1a1a2e", height: 20, textAlign: "center" },
  barTrack:         { width: 28, height: 100, backgroundColor: "#f3f4f6", borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  barFill:          { width: "100%", backgroundColor: "#1a1a2e", borderRadius: 8 },
  barFillToday:     { backgroundColor: "#16a34a" },
  barDateLabel:     { fontSize: 10, color: "#9ca3af", marginTop: 8, textAlign: "center", width: 48 },
  barDateLabelToday:{ color: "#16a34a", fontWeight: "700" },
  chartFooter:      { borderTopWidth: 1, borderTopColor: "#f3f4f6", marginTop: 12, paddingVertical: 10, paddingHorizontal: 16 },
  chartNote:        { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  listCard:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  empty:            { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 12 },
  serviceRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  serviceRowLeft:   { flex: 1, marginRight: 12 },
  serviceRankRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  rank:             { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rankText:         { fontSize: 11, fontWeight: "800", color: "#1a1a2e" },
  serviceRowName:   { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  revenueBarBg:     { height: 5, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  revenueBarFill:   { height: "100%", backgroundColor: "#16a34a", borderRadius: 3 },
  serviceRowRight:  { alignItems: "flex-end", gap: 4 },
  serviceRowRevenue:{ fontSize: 14, fontWeight: "700", color: "#16a34a" },
  serviceRowCount:  { fontSize: 12, color: "#9ca3af" },
  stylistRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  stylistRank:      { width: 24, alignItems: "center" },
  stylistRankText:  { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stylistAvatar:    { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistName:      { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  stylistMeta:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  stylistRevenue:   { fontSize: 14, fontWeight: "700", color: "#16a34a" },
});

// ── Inline calendar styles ────────────────────────────────────────────────────
const cal = StyleSheet.create({
  container:    { marginTop: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 12 },
  monthNav:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  navText:      { fontSize: 20, color: "#1a1a2e", fontWeight: "600", lineHeight: 24 },
  monthLabel:   { fontSize: 15, fontWeight: "800", color: "#1a1a2e" },
  weekRow:      { flexDirection: "row", marginBottom: 2 },
  weekLabel:    { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#9ca3af", paddingVertical: 6 },
  grid:         { flexDirection: "row", flexWrap: "wrap" },
  cell:         { width: "14.28%", height: 42, alignItems: "center", justifyContent: "center" },
  cellSel:      { backgroundColor: "#1a1a2e", borderRadius: 21 },
  cellToday:    { backgroundColor: "#eff6ff", borderRadius: 21 },
  cellOff:      { opacity: 0.25 },
  cellText:     { fontSize: 14, color: "#1a1a2e", fontWeight: "500" },
  cellTextSel:  { color: "#fff", fontWeight: "800" },
  cellTextToday:{ color: "#1d4ed8", fontWeight: "700" },
  cellTextOff:  { color: "#9ca3af" },
});
