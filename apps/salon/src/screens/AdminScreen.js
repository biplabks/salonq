// apps/salon/src/screens/AdminScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, Switch, TouchableOpacity,
  TextInput, StyleSheet, SafeAreaView, ActivityIndicator,
  Alert, RefreshControl,
} from "react-native";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, Timestamp, serverTimestamp, getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminScreen() {
  const [stats,       setStats]       = useState({ salons: 0, queueToday: 0, customers: 0 });
  const [salons,      setSalons]      = useState([]);
  const [staffEmails, setStaffEmails] = useState({}); // { salonId: email }
  const [search,      setSearch]      = useState("");
  const [inviteCode,  setInviteCode]  = useState("");
  const [inviteDraft, setInviteDraft] = useState("");
  const [savingCode,  setSavingCode]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const filteredSalons = search.trim() === ""
    ? salons
    : salons.filter((s) => {
        const q     = search.toLowerCase();
        const email = (staffEmails[s.id] || "").toLowerCase();
        const city  = (s.city || (s.address || "").split(",").slice(-2, -1)[0] || "").toLowerCase();
        return (
          (s.name    || "").toLowerCase().includes(q) ||
          email.includes(q) ||
          city.includes(q)
        );
      });

  const loadAll = useCallback(async () => {
    try {
      // ── 1. Salons (publicly readable — must never fail) ────────────────────
      const salonsSnap = await getDocs(collection(db, "salons"));
      const salonDocs  = salonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSalons(salonDocs);
      setStats((prev) => ({ ...prev, salons: salonDocs.length }));

      // ── 2. Staff emails + queue count + customers — all independent ────────
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTs = Timestamp.fromDate(todayStart);

      const [staffResult, custResult, inviteResult, ...queueResults] =
        await Promise.allSettled([
          getDocs(collection(db, "salonStaff")),
          getCountFromServer(collection(db, "customers")),
          getDoc(doc(db, "config", "invite")),
          ...salonDocs.map((salon) =>
            getCountFromServer(
              query(
                collection(db, "salons", salon.id, "queue"),
                where("joinedAt", ">=", todayTs)
              )
            )
          ),
        ]);

      // Staff emails
      if (staffResult.status === "fulfilled") {
        const emailMap = {};
        staffResult.value.docs.forEach((d) => {
          const { salonId, email } = d.data();
          if (salonId && email) emailMap[salonId] = email;
        });
        setStaffEmails(emailMap);
      } else {
        console.warn("salonStaff fetch failed:", staffResult.reason?.message);
      }

      // Customer count
      if (custResult.status === "fulfilled") {
        setStats((prev) => ({ ...prev, customers: custResult.value.data().count }));
      } else {
        console.warn("Customer count failed:", custResult.reason?.message);
      }

      // Invite code
      if (inviteResult.status === "fulfilled" && inviteResult.value.exists()) {
        const code = inviteResult.value.data().code ?? "";
        setInviteCode(code);
        setInviteDraft(code);
      }

      // Queue today — sum fulfilled counts only
      const totalQueueToday = queueResults.reduce((sum, r) =>
        r.status === "fulfilled" ? sum + r.value.data().count : sum, 0
      );
      setStats((prev) => ({ ...prev, queueToday: totalQueueToday }));

    } catch (err) {
      Alert.alert("Admin load error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const toggleSalon = async (salon) => {
    const next = !salon.disabled;
    try {
      await updateDoc(doc(db, "salons", salon.id), {
        disabled: next, updatedAt: serverTimestamp(),
      });
      setSalons((prev) =>
        prev.map((s) => (s.id === salon.id ? { ...s, disabled: next } : s))
      );
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const saveInviteCode = async () => {
    setSavingCode(true);
    try {
      await setDoc(
        doc(db, "config", "invite"),
        { code: inviteDraft, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setInviteCode(inviteDraft);
      Alert.alert("Saved", "Invite code updated.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingCode(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={filteredSalons}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            <Text style={s.heading}>🛡️ Admin Panel</Text>

            {/* Stats bar */}
            <View style={s.statsRow}>
              <StatCard label="Salons"      value={stats.salons} />
              <StatCard label="Queue Today" value={stats.queueToday} />
              <StatCard label="Customers"   value={stats.customers} />
            </View>

            {/* Invite code editor */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Invite Code</Text>
              <View style={s.inviteRow}>
                <TextInput
                  style={s.inviteInput}
                  value={inviteDraft}
                  onChangeText={setInviteDraft}
                  placeholder="Enter invite code…"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[s.saveBtn, (savingCode || inviteDraft === inviteCode) && s.saveBtnOff]}
                  onPress={saveInviteCode}
                  disabled={savingCode || inviteDraft === inviteCode}
                >
                  {savingCode
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, email or city…"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <Text style={s.listHeader}>
              {search.trim() ? `${filteredSalons.length} of ${salons.length} salons` : "All Salons"}
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const email = staffEmails[item.id] || "—";
          const city  = item.city || (item.address || "").split(",").slice(-2, -1)[0]?.trim() || "—";
          return (
            <View style={[s.salonRow, item.disabled && s.salonRowDisabled]}>
              <View style={s.salonInfo}>
                <Text style={s.salonName}>{item.name}</Text>
                <Text style={s.salonMeta}>{email}</Text>
                <Text style={s.salonMeta}>{city} · {formatDate(item.createdAt)}</Text>
              </View>
              <Switch
                value={!item.disabled}
                onValueChange={() => toggleSalon(item)}
                trackColor={{ false: "#f87171", true: "#86efac" }}
                thumbColor="#fff"
              />
            </View>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No salons yet.</Text>}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  list:           { padding: 16, paddingBottom: 40 },
  heading:        { fontSize: 24, fontWeight: "900", color: "#1a1a2e", marginBottom: 16 },
  statsRow:       { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard:       { flex: 1, backgroundColor: "#1a1a2e", borderRadius: 14, padding: 14, alignItems: "center" },
  statValue:      { fontSize: 28, fontWeight: "900", color: "#fff" },
  statLabel:      { fontSize: 10, color: "#9ca3af", marginTop: 2, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  card:           { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTitle:      { fontSize: 13, fontWeight: "800", color: "#1a1a2e", marginBottom: 12 },
  inviteRow:      { flexDirection: "row", gap: 10, alignItems: "center" },
  inviteInput:    { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#1a1a2e" },
  saveBtn:        { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  saveBtnOff:     { backgroundColor: "#9ca3af" },
  saveBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  searchInput:    { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#1a1a2e", borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 12 },
  listHeader:     { fontSize: 13, fontWeight: "800", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  salonRow:       { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  salonRowDisabled:{ opacity: 0.5 },
  salonInfo:      { flex: 1 },
  salonName:      { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  salonMeta:      { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty:          { textAlign: "center", color: "#9ca3af", marginTop: 32, fontSize: 14 },
});
