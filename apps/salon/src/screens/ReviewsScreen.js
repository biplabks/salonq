// apps/salon/src/screens/ReviewsScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, SafeAreaView,
} from "react-native";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";
import { crossAlert } from "../utils/crossAlert";

const StarDisplay = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: "row", gap: 1 }}>
    {[1,2,3,4,5].map((star) => (
      <Text key={star} style={{ fontSize: size, color: star <= rating ? "#F59E0B" : "#e5e7eb" }}>★</Text>
    ))}
  </View>
);

export default function ReviewsScreen({ salonId, salon }) {
  const [reviews,    setReviews]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [replyModal, setReplyModal] = useState(null);
  const [replyText,  setReplyText]  = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    const unsub = onSnapshot(
      query(collection(firestore, "salons", salonId, "reviews"), orderBy("createdAt", "desc")),
      (snap) => { setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
    return unsub;
  }, [salonId]);

  const handleReply = async () => {
    if (!replyText.trim()) { crossAlert("Empty reply", "Please write a reply."); return; }
    setSubmitting(true);
    try {
      await updateDoc(doc(firestore, "salons", salonId, "reviews", replyModal.id), {
        salonReply: replyText.trim(), salonRepliedAt: serverTimestamp(),
      });
      setReplyModal(null); setReplyText("");
    } catch (err) {
      crossAlert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.salonRating, 0) / reviews.length).toFixed(1)
    : "—";

  if (loading) return <View style={s.center}><ActivityIndicator color="#1a1a2e" size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Reviews</Text>
        <View style={s.ratingBadge}>
          <Text style={s.ratingBadgeStar}>★</Text>
          <Text style={s.ratingBadgeText}>{avgRating}</Text>
          <Text style={s.ratingBadgeCount}>({reviews.length})</Text>
        </View>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.reviewCard}>
            <View style={s.reviewHeader}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.customerName?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewerName}>{item.customerName || "Anonymous"}</Text>
                <Text style={s.reviewDate}>{formatDate(item.createdAt)}</Text>
              </View>
              {!item.salonReply && (
                <TouchableOpacity style={s.replyBtn} onPress={() => { setReplyModal(item); setReplyText(""); }}>
                  <Text style={s.replyBtnText}>Reply</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.ratingRow}>
              <StarDisplay rating={item.salonRating} />
              <Text style={s.ratingLabel}>Overall</Text>
            </View>
            {item.stylistRating > 0 && item.stylistName && (
              <View style={s.ratingRow}>
                <StarDisplay rating={item.stylistRating} />
                <Text style={s.ratingLabel}>💇 {item.stylistName}</Text>
              </View>
            )}
            {item.review ? <Text style={s.reviewText}>{item.review}</Text> : null}
            {item.salonReply && (
              <View style={s.replyCard}>
                <View style={s.replyHeader}>
                  <Text style={s.replyLabel}>Your reply:</Text>
                  <TouchableOpacity onPress={() => { setReplyModal(item); setReplyText(item.salonReply); }}>
                    <Text style={s.editReply}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.replyText}>{item.salonReply}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>⭐</Text>
            <Text style={s.emptyText}>No reviews yet</Text>
            <Text style={s.emptySub}>Reviews will appear here after customers rate their visits.</Text>
          </View>
        }
      />

      <Modal visible={!!replyModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>Reply to Review</Text>
            <TouchableOpacity onPress={() => setReplyModal(null)}><Text style={m.close}>✕</Text></TouchableOpacity>
          </View>
          {replyModal && (
            <View style={m.originalReview}>
              <StarDisplay rating={replyModal.salonRating} />
              {replyModal.review
                ? <Text style={m.originalText}>{replyModal.review}</Text>
                : <Text style={m.originalEmpty}>No written review</Text>
              }
            </View>
          )}
          <Text style={m.label}>Your reply</Text>
          <TextInput
            style={m.input}
            placeholder="Thank the customer, address their feedback..."
            value={replyText}
            onChangeText={setReplyText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
          />
          <TouchableOpacity style={[m.submitBtn, !replyText.trim() && { opacity: 0.4 }]} onPress={handleReply} disabled={submitting || !replyText.trim()}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={m.submitBtnText}>Post Reply</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:            { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  ratingBadge:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef9c3", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  ratingBadgeStar:  { fontSize: 16, color: "#F59E0B" },
  ratingBadgeText:  { fontSize: 16, fontWeight: "800", color: "#1a1a2e" },
  ratingBadgeCount: { fontSize: 12, color: "#6b7280" },
  list:             { padding: 16, gap: 12, paddingBottom: 40 },
  reviewCard:       { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  reviewHeader:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar:           { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" },
  avatarText:       { fontSize: 16, color: "#fff", fontWeight: "700" },
  reviewerName:     { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  reviewDate:       { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  replyBtn:         { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  replyBtnText:     { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  ratingRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  ratingLabel:      { fontSize: 12, color: "#6b7280" },
  reviewText:       { fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 4 },
  replyCard:        { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 12, borderLeftWidth: 3, borderLeftColor: "#16a34a" },
  replyHeader:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  replyLabel:       { fontSize: 12, fontWeight: "700", color: "#16a34a" },
  editReply:        { fontSize: 12, color: "#6b7280" },
  replyText:        { fontSize: 13, color: "#374151", lineHeight: 18 },
  empty:            { alignItems: "center", marginTop: 80, gap: 8, paddingHorizontal: 32 },
  emptyEmoji:       { fontSize: 48 },
  emptyText:        { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:         { fontSize: 13, color: "#9ca3af", textAlign: "center" },
});

const m = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa", padding: 20 },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:          { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  close:          { fontSize: 20, color: "#6b7280" },
  originalReview: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 16 },
  originalText:   { fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 8 },
  originalEmpty:  { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  label:          { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 8 },
  input:          { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 14, color: "#1a1a2e", minHeight: 100 },
  submitBtn:      { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  submitBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});
