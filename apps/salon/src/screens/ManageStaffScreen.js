// apps/salon/src/screens/ManageStaffScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, FlatList, ActivityIndicator,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getStaffList, removeStaffMember } from "../firebase";
import { crossAlert, crossAlertInfo } from "../utils/crossAlert";

export default function ManageStaffScreen({ salon, salonId, onBack }) {
  const [staff,      setStaff]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [removing,   setRemoving]   = useState(null); // uid being removed

  const currentUid = getAuth().currentUser?.uid;

  // Owner check: ownerId on salon doc (new salons), fall back to current user's role in their own doc
  const isOwner = salon?.ownerId
    ? salon.ownerId === currentUid
    : staff.find((s) => s.uid === currentUid)?.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getStaffList(salonId);
      // Sort: current user first, then by join date
      list.sort((a, b) => {
        if (a.uid === currentUid) return -1;
        if (b.uid === currentUid) return 1;
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setStaff(list);
    } catch (err) {
      crossAlertInfo("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = (member) => {
    crossAlert(
      "Remove staff member?",
      `${member.email} will lose access to this salon immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(member.uid);
            try {
              await removeStaffMember(member.uid);
              setStaff((prev) => prev.filter((s) => s.uid !== member.uid));
            } catch (err) {
              crossAlertInfo("Error", err.message);
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  const renderItem = ({ item }) => {
    const isSelf      = item.uid === currentUid;
    const isItemOwner = item.role === "owner" || salon?.ownerId === item.uid;
    const canRemove   = isOwner && !isSelf;
    const isBeingRemoved = removing === item.uid;

    return (
      <View style={[s.row, isSelf && s.rowSelf]}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(item.email?.[0] || "?").toUpperCase()}
          </Text>
        </View>

        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.email} numberOfLines={1}>{item.email}</Text>
            {isSelf && <View style={s.youBadge}><Text style={s.youText}>You</Text></View>}
          </View>
          <View style={s.metaRow}>
            <View style={[s.roleBadge, isItemOwner ? s.roleBadgeOwner : s.roleBadgeStaff]}>
              <Text style={[s.roleText, isItemOwner ? s.roleTextOwner : s.roleTextStaff]}>
                {isItemOwner ? "Owner" : "Staff"}
              </Text>
            </View>
            <Text style={s.joinDate}>Joined {formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {canRemove && (
          isBeingRemoved
            ? <ActivityIndicator size="small" color="#ef4444" />
            : (
              <TouchableOpacity style={s.removeBtn} onPress={() => handleRemove(item)}>
                <Text style={s.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Manage Staff</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={s.summary}>
              <Text style={s.summaryText}>
                {staff.length} staff member{staff.length !== 1 ? "s" : ""} have access to {salon?.name || "this salon"}.
              </Text>
              {!isOwner && (
                <Text style={s.ownerNote}>Only the salon owner can remove staff members.</Text>
              )}
            </View>
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No staff members found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:           { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:          { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  list:           { padding: 16, paddingBottom: 40 },
  summary:        { marginBottom: 16 },
  summaryText:    { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  ownerNote:      { fontSize: 12, color: "#d97706", marginTop: 4 },
  row:            { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", gap: 12 },
  rowSelf:        { borderColor: "#1a1a2e" },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText:     { fontSize: 18, fontWeight: "800", color: "#fff" },
  info:           { flex: 1, gap: 4 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 6 },
  email:          { fontSize: 14, fontWeight: "600", color: "#1a1a2e", flexShrink: 1 },
  youBadge:       { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  youText:        { fontSize: 11, color: "#1d4ed8", fontWeight: "700" },
  metaRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  roleBadge:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  roleBadgeOwner: { backgroundColor: "#fef3c7" },
  roleBadgeStaff: { backgroundColor: "#f3f4f6" },
  roleText:       { fontSize: 11, fontWeight: "700" },
  roleTextOwner:  { color: "#d97706" },
  roleTextStaff:  { color: "#6b7280" },
  joinDate:       { fontSize: 11, color: "#9ca3af" },
  removeBtn:      { backgroundColor: "#fee2e2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  removeBtnText:  { fontSize: 13, color: "#ef4444", fontWeight: "700" },
  empty:          { alignItems: "center", paddingTop: 40 },
  emptyText:      { fontSize: 14, color: "#9ca3af" },
});
