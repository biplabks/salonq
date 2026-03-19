// apps/customer/src/screens/ReviewScreen.js
// Shown after payment is confirmed — customer can rate salon + stylist

import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from "react-native";
import {
  collection, addDoc, doc, updateDoc,
  serverTimestamp, getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";

const StarRating = ({ rating, onRate, size = 36, label }) => (
  <View style={sr.container}>
    {label && <Text style={sr.label}>{label}</Text>}
    <View style={sr.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate && onRate(star)} disabled={!onRate}>
          <Text style={[sr.star, { fontSize: size, color: star <= rating ? "#F59E0B" : "#e5e7eb" }]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
    <Text style={sr.ratingText}>
      {rating === 0 ? "Tap to rate" : rating === 1 ? "Poor" : rating === 2 ? "Fair" :
       rating === 3 ? "Good" : rating === 4 ? "Very good" : "Excellent!"}
    </Text>
  </View>
);

const sr = StyleSheet.create({
  container:  { alignItems: "center", marginVertical: 8 },
  label:      { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 8 },
  stars:      { flexDirection: "row", gap: 4 },
  star:       { lineHeight: 44 },
  ratingText: { fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: "500" },
});

export default function ReviewScreen({ route, navigation }) {
  const { salonId, entryId, salonName, stylistId, stylistName } = route.params;
  const [salonRating,   setSalonRating]   = useState(0);
  const [stylistRating, setStylistRating] = useState(0);
  const [review,        setReview]        = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);

  const user = getAuth().currentUser;

  const handleSubmit = async () => {
    if (salonRating === 0) { Alert.alert("Rate the salon", "Please give the salon a star rating."); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "salons", salonId, "reviews"), {
        salonId,
        customerId:    user?.uid || null,
        customerName:  user?.displayName || user?.email || "Anonymous",
        entryId,
        salonRating,
        stylistRating: stylistId ? stylistRating : null,
        stylistId:     stylistId || null,
        stylistName:   stylistName || null,
        review:        review.trim(),
        salonReply:    null,
        createdAt:     serverTimestamp(),
      });

      await updateDoc(doc(db, "salons", salonId, "queue", entryId), { reviewed: true });

      // Update salon avg rating
      const salonSnap = await getDoc(doc(db, "salons", salonId));
      if (salonSnap.exists()) {
        const data         = salonSnap.data();
        const totalRatings = (data.totalRatings || 0) + 1;
        const totalScore   = (data.totalScore   || 0) + salonRating;
        await updateDoc(doc(db, "salons", salonId), {
          avgRating: Math.round((totalScore / totalRatings) * 10) / 10,
          totalRatings, totalScore,
        });
      }
      setSubmitted(true);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.thankYou}>
          <Text style={s.thankYouEmoji}>🌟</Text>
          <Text style={s.thankYouTitle}>Thank you!</Text>
          <Text style={s.thankYouSub}>Your review helps others find great salons.</Text>
          <View style={s.starsDisplay}>
            {[1,2,3,4,5].map((star) => (
              <Text key={star} style={[s.starDisplay, { color: star <= salonRating ? "#F59E0B" : "#e5e7eb" }]}>★</Text>
            ))}
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}>
            <Text style={s.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.skip}>Skip</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rate your visit</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <View style={s.salonInfo}>
            <Text style={s.salonEmoji}>✂️</Text>
            <Text style={s.salonName}>{salonName}</Text>
          </View>
          <StarRating rating={salonRating} onRate={setSalonRating} size={44} label="How was your overall experience?" />
        </View>

        {stylistId && stylistName && (
          <View style={s.card}>
            <View style={s.stylistInfo}>
              <View style={s.stylistAvatar}><Text style={{ fontSize: 22 }}>💇</Text></View>
              <View>
                <Text style={s.stylistName}>{stylistName}</Text>
                <Text style={s.stylistLabel}>Your stylist</Text>
              </View>
            </View>
            <StarRating rating={stylistRating} onRate={setStylistRating} size={36} label="How was your stylist?" />
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Write a review (optional)</Text>
          <TextInput
            style={s.reviewInput}
            placeholder="Tell others about your experience..."
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{review.length}/500</Text>
        </View>

        <TouchableOpacity style={[s.submitBtn, salonRating === 0 && { opacity: 0.4 }]} onPress={handleSubmit} disabled={submitting || salonRating === 0}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Review ✨</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fafafa" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  skip:           { fontSize: 15, color: "#9ca3af" },
  headerTitle:    { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  content:        { padding: 16, gap: 12, paddingBottom: 40 },
  card:           { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTitle:      { fontSize: 14, fontWeight: "700", color: "#1a1a2e", marginBottom: 6 },
  salonInfo:      { alignItems: "center", marginBottom: 16 },
  salonEmoji:     { fontSize: 40, marginBottom: 8 },
  salonName:      { fontSize: 18, fontWeight: "800", color: "#1a1a2e" },
  stylistInfo:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  stylistAvatar:  { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  stylistName:    { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  stylistLabel:   { fontSize: 12, color: "#6b7280", marginTop: 2 },
  reviewInput:    { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, fontSize: 14, color: "#1a1a2e", minHeight: 100, borderWidth: 1, borderColor: "#e5e7eb" },
  charCount:      { fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 6 },
  submitBtn:      { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  submitBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  thankYou:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  thankYouEmoji:  { fontSize: 64 },
  thankYouTitle:  { fontSize: 28, fontWeight: "900", color: "#1a1a2e" },
  thankYouSub:    { fontSize: 14, color: "#6b7280", textAlign: "center" },
  starsDisplay:   { flexDirection: "row", gap: 6, marginVertical: 8 },
  starDisplay:    { fontSize: 36 },
  doneBtn:        { backgroundColor: "#1a1a2e", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  doneBtnText:    { color: "#fff", fontSize: 16, fontWeight: "700" },
});
