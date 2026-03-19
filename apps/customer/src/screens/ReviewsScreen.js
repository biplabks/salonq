// apps/customer/src/screens/ReviewsScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, SafeAreaView,
} from "react-native";
import {
  collection, query, orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

const StarDisplay = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: "row", gap: 1 }}>
    {[1,2,3,4,5].map((star) => (
      <Text key={star} style={{ fontSize: size, color: star <= rating ? "#F59E0B" : "#e5e7eb" }}>★</Text>
    ))}
  </View>
);

export default function ReviewsScreen({ route, navigation }) {
  const { salonId, salonName, avgRating, totalRatings } = route.params;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    const unsub = onSnapshot(
      query(collection(db, "salons", salonId, "reviews"), orderBy("createdAt", "desc")),
      (snap) => { setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
    return unsub;
  }, [salonId]);

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  const displayAvg = avgRating || (reviews.length
    ? (reviews.reduce((s, r) => s + r.salonRating, 0) / reviews.length).toFixed(1)
    : "—");

  if (loading) return <View style={s.center}><ActivityIndicator color="#1a1a2e" size="large" /></View>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>{salonName}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.ratingSummary}>
        <Text style={s.ratingBig}>{displayAvg}</Text>
        <StarDisplay rating={Math.round(avgRating || 0)} size={20} />
        <Text style={s.ratingCount}>{totalRatings || reviews.length} reviews</Text>
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
            </View>
            <StarDisplay rating={item.salonRating} />
            {item.stylistRating > 0 && item.stylistName && (
              <View style={s.stylistRatingRow}>
                <StarDisplay rating={item.stylistRating} size={12} />
                <Text style={s.stylistRatingLabel}>💇 {item.stylistName}</Text>
              </View>
            )}
            {item.review ? <Text style={s.reviewText}>{item.review}</Text> : null}
            {item.salonReply && (
              <View style={s.replyCard}>
                <Text style={s.replyLabel}>Reply from salon:</Text>
                <Text style={s.replyText}>{item.salonReply}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>⭐</Text>
            <Text style={s.emptyText}>No reviews yet</Text>
            <Text style={s.emptySub}>Be the first to review this salon!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fafafa" },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  back:             { fontSize: 15, color: "#1a1a2e", fontWeight: "600", width: 60 },
  title:            { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  ratingSummary:    { alignItems: "center", paddingVertical: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 6 },
  ratingBig:        { fontSize: 48, fontWeight: "900", color: "#1a1a2e" },
  ratingCount:      { fontSize: 13, color: "#6b7280" },
  list:             { padding: 16, gap: 12, paddingBottom: 40 },
  reviewCard:       { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  reviewHeader:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  avatar:           { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" },
  avatarText:       { fontSize: 16, color: "#fff", fontWeight: "700" },
  reviewerName:     { fontSize: 14, fontWeight: "700", color: "#1a1a2e" },
  reviewDate:       { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  stylistRatingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  stylistRatingLabel:{ fontSize: 12, color: "#6b7280" },
  reviewText:       { fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 8 },
  replyCard:        { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 12, borderLeftWidth: 3, borderLeftColor: "#16a34a" },
  replyLabel:       { fontSize: 12, fontWeight: "700", color: "#16a34a", marginBottom: 4 },
  replyText:        { fontSize: 13, color: "#374151", lineHeight: 18 },
  empty:            { alignItems: "center", marginTop: 80, gap: 8, paddingHorizontal: 32 },
  emptyEmoji:       { fontSize: 48 },
  emptyText:        { fontSize: 16, color: "#6b7280", fontWeight: "600" },
  emptySub:         { fontSize: 13, color: "#9ca3af", textAlign: "center" },
});
