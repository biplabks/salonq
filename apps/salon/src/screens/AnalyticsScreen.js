// apps/salon/src/screens/AnalyticsScreen.js
// Same as before but stylistStats filters out unassigned entries
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../firebase";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const formatCurrency = (amount) => `৳${Number(amount || 0).toLocaleString()}`;
const formatWait     = (min)    => !min || min <= 0 ? "0 min" : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const startOfWeek  = () => {
  const now = new Date(), day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(now); mon.setDate(diff); mon.setHours(0,0,0,0);
  return mon;
};
const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

export default function AnalyticsScreen({ salonId, salon }) {
  const [loading,          setLoading]         = useState(true);
  const [todayStats,       setTodayStats]       = useState({ customers: 0, revenue: 0, avgWait: 0, noShows: 0 });
  const [weeklyData,       setWeeklyData]       = useState(Array(7).fill(0));
  const [topServices,      setTopServices]      = useState([]);
  const [revenueByService, setRevenueByService] = useState([]);
  const [stylistStats,     setStylistStats]     = useState([]);

  useEffect(() => { if (salonId) fetchAnalytics(); }, [salonId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const snap    = await getDocs(collection(firestore, "salons", salonId, "queue"));
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todayStart = startOfToday();
      const weekStart  = startOfWeek();

      // Today's entries
      const todayEntries = entries.filter((e) => { const j = toDate(e.joinedAt); return j && j >= todayStart; });
      const todayDone    = todayEntries.filter((e) => e.status === "done");
      const todayNoShows = todayEntries.filter((e) => e.status === "no-show");
      const todayRevenue = todayDone.reduce((sum, e) =>
        sum + (e.totalAfterDiscount || (e.services || []).reduce((s, sv) => s + (sv.price || 0), 0)), 0);

      const waits = todayDone
        .filter((e) => e.joinedAt && e.calledAt)
        .map((e) => { const j = toDate(e.joinedAt), c = toDate(e.calledAt); return (!j || !c) ? 0 : Math.max(0, (c - j) / 60000); })
        .filter((w) => w > 0);
      const avgWait = waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : 0;

      setTodayStats({ customers: todayDone.length, revenue: todayRevenue, avgWait, noShows: todayNoShows.length });

      // Weekly
      const weekEntries = entries.filter((e) => { const j = toDate(e.joinedAt); return j && j >= weekStart; });
      const counts = Array(7).fill(0);
      weekEntries.forEach((e) => { const j = toDate(e.joinedAt); if (j) counts[(j.getDay() + 6) % 7]++; });
      setWeeklyData(counts);

      // Service & stylist stats
      const weekDone   = weekEntries.filter((e) => e.status === "done");
      const serviceMap = {};
      const stylistMap = {};

      weekDone.forEach((entry) => {
        const entryRevenue = entry.totalAfterDiscount
          || (entry.services || []).reduce((s, sv) => s + (sv.price || 0), 0);

        // Services
        (entry.services || []).forEach((sv) => {
          if (!serviceMap[sv.name]) serviceMap[sv.name] = { name: sv.name, count: 0, revenue: 0 };
          serviceMap[sv.name].count++;
          serviceMap[sv.name].revenue += sv.price || 0;
        });

        // Stylists — only count entries WITH a real stylist assigned
        if (entry.stylistId) {
          const stylist = (salon?.stylists || []).find((s) => s.id === entry.stylistId);
          if (!stylistMap[entry.stylistId]) {
            stylistMap[entry.stylistId] = {
              id:      entry.stylistId,
              name:    stylist?.name || "Unknown stylist",
              count:   0,
              revenue: 0,
            };
          }
          stylistMap[entry.stylistId].count++;
          stylistMap[entry.stylistId].revenue += entryRevenue;
        }
      });

      const sortedServices = Object.values(serviceMap).sort((a, b) => b.count - a.count);
      setTopServices(sortedServices.slice(0, 5));
      setRevenueByService(Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      setStylistStats(Object.values(stylistMap).sort((a, b) => b.count - a.count));

    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  const maxWeekly  = Math.max(...weeklyData, 1);
  const maxRevenue = Math.max(...revenueByService.map((s) => s.revenue), 1);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={s.loadingText}>Loading analytics…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Analytics</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={fetchAnalytics}>
          <Text style={s.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Today's Summary */}
        <Text style={s.sectionTitle}>📊 Today's Summary</Text>
        <View style={s.statsGrid}>
          <StatCard label="Customers served" value={todayStats.customers}              color="#1a1a2e" />
          <StatCard label="Revenue"          value={formatCurrency(todayStats.revenue)} color="#16a34a" small />
          <StatCard label="Avg wait"         value={formatWait(todayStats.avgWait)}    color="#d97706" small />
          <StatCard label="No-shows"         value={todayStats.noShows}                color="#ef4444" />
        </View>

        {/* Weekly Chart */}
        <Text style={s.sectionTitle}>📈 Customers This Week</Text>
        <View style={s.chartCard}>
          <View style={s.barChart}>
            {weeklyData.map((count, i) => {
              const barHeight = (count / maxWeekly) * 120;
              const isToday   = i === (new Date().getDay() + 6) % 7;
              return (
                <View key={i} style={s.barWrapper}>
                  <Text style={s.barValue}>{count > 0 ? count : ""}</Text>
                  <View style={s.barBg}>
                    <View style={[s.bar, { height: Math.max(barHeight, 4) }, isToday && s.barToday]} />
                  </View>
                  <Text style={[s.barLabel, isToday && s.barLabelToday]}>{DAY_LABELS[i]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={s.chartNote}>Total this week: {weeklyData.reduce((s, c) => s + c, 0)} customers</Text>
        </View>

        {/* Revenue by Service */}
        <Text style={s.sectionTitle}>💰 Revenue by Service (This Week)</Text>
        <View style={s.listCard}>
          {revenueByService.length === 0
            ? <Text style={s.empty}>Complete some services to see revenue data.</Text>
            : revenueByService.map((item, i) => (
              <View key={i} style={s.serviceRow}>
                <View style={s.serviceRowLeft}>
                  <Text style={s.serviceRowName}>{item.name}</Text>
                  <View style={s.revenueBarBg}>
                    <View style={[s.revenueBarFill, { width: `${Math.round((item.revenue / maxRevenue) * 100)}%` }]} />
                  </View>
                </View>
                <Text style={s.serviceRowRevenue}>{formatCurrency(item.revenue)}</Text>
              </View>
            ))
          }
        </View>

        {/* Top Services */}
        <Text style={s.sectionTitle}>⭐ Top Services (This Week)</Text>
        <View style={s.listCard}>
          {topServices.length === 0
            ? <Text style={s.empty}>Complete some services to see top services.</Text>
            : topServices.map((item, i) => (
              <View key={i} style={s.topRow}>
                <View style={[s.rank, { backgroundColor: i === 0 ? "#fef9c3" : i === 1 ? "#f3f4f6" : "#fff7ed" }]}>
                  <Text style={s.rankText}>#{i + 1}</Text>
                </View>
                <Text style={s.topName}>{item.name}</Text>
                <View style={s.countBadge}><Text style={s.countText}>{item.count}x</Text></View>
              </View>
            ))
          }
        </View>

        {/* Stylist Performance */}
        <Text style={s.sectionTitle}>👥 Stylist Performance (This Week)</Text>
        <View style={s.listCard}>
          {stylistStats.length === 0
            ? <Text style={s.empty}>No stylist-assigned services this week yet.</Text>
            : stylistStats.map((stylist, i) => (
              <View key={i} style={s.stylistRow}>
                <View style={s.stylistAvatar}><Text style={{ fontSize: 20 }}>💇</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stylistName}>{stylist.name}</Text>
                  <Text style={s.stylistMeta}>{stylist.count} customer{stylist.count !== 1 ? "s" : ""} served</Text>
                </View>
                <Text style={s.stylistRevenue}>{formatCurrency(stylist.revenue)}</Text>
              </View>
            ))
          }
        </View>

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
  center:           { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:      { fontSize: 14, color: "#6b7280" },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:            { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  refreshBtn:       { backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText:      { fontSize: 13, color: "#1a1a2e", fontWeight: "600" },
  content:          { padding: 16, paddingBottom: 40 },
  sectionTitle:     { fontSize: 15, fontWeight: "800", color: "#1a1a2e", marginTop: 20, marginBottom: 10 },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:         { backgroundColor: "#fff", borderRadius: 14, padding: 16, flex: 1, minWidth: "45%", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  statValue:        { fontSize: 26, fontWeight: "900" },
  statLabel:        { fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "center" },
  chartCard:        { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  barChart:         { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160, paddingTop: 20 },
  barWrapper:       { alignItems: "center", flex: 1 },
  barValue:         { fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: "600" },
  barBg:            { width: 28, backgroundColor: "#f3f4f6", borderRadius: 6, height: 120, justifyContent: "flex-end" },
  bar:              { backgroundColor: "#1a1a2e", borderRadius: 6, width: "100%" },
  barToday:         { backgroundColor: "#16a34a" },
  barLabel:         { fontSize: 11, color: "#9ca3af", marginTop: 6 },
  barLabelToday:    { color: "#16a34a", fontWeight: "700" },
  chartNote:        { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 12 },
  listCard:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  empty:            { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 12 },
  serviceRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  serviceRowLeft:   { flex: 1, marginRight: 12 },
  serviceRowName:   { fontSize: 14, fontWeight: "600", color: "#1a1a2e", marginBottom: 6 },
  revenueBarBg:     { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  revenueBarFill:   { height: "100%", backgroundColor: "#16a34a", borderRadius: 3 },
  serviceRowRevenue:{ fontSize: 14, fontWeight: "700", color: "#16a34a" },
  topRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  rank:             { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankText:         { fontSize: 12, fontWeight: "800", color: "#1a1a2e" },
  topName:          { flex: 1, fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  countBadge:       { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  countText:        { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  stylistRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  stylistAvatar:    { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistName:      { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  stylistMeta:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  stylistRevenue:   { fontSize: 14, fontWeight: "700", color: "#16a34a" },
});
