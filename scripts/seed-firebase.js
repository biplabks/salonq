// scripts/seed-firebase.js
// Run ONCE to populate Firestore with a sample salon.
//
// Setup:
//   1. npm install firebase-admin
//   2. Download service account from Firebase Console →
//      Project Settings → Service accounts → Generate new private key
//   3. Save it as scripts/service-account.json
//   4. node scripts/seed-firebase.js

const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const sampleSalon = {
  name: "Style Studio",
  address: "123 Gulshan Avenue, Dhaka",
  city: "Dhaka",
  phone: "+880 1700 000000",
  photos: [],
  location: { lat: 23.7937, lng: 90.4066 },
  avgWaitMin: 20,
  queueCount: 2,
  isOpen: true,
  hours: {
    mon: { open: "09:00", close: "20:00", closed: false },
    tue: { open: "09:00", close: "20:00", closed: false },
    wed: { open: "09:00", close: "20:00", closed: false },
    thu: { open: "09:00", close: "20:00", closed: false },
    fri: { open: "14:00", close: "21:00", closed: false },
    sat: { open: "09:00", close: "20:00", closed: false },
    sun: { open: "10:00", close: "18:00", closed: false },
  },
  services: [
    { id: "s1", name: "Haircut",            price: 300,  durationMin: 30 },
    { id: "s2", name: "Haircut & Blow-dry", price: 500,  durationMin: 45 },
    { id: "s3", name: "Hair Colour",        price: 1500, durationMin: 90 },
    { id: "s4", name: "Head Massage",       price: 250,  durationMin: 20 },
    { id: "s5", name: "Beard Trim",         price: 150,  durationMin: 15 },
  ],
  stylists: [
    { id: "st1", name: "Rina Akter",   photo: "", skills: ["Haircut", "Hair Colour"], status: "available" },
    { id: "st2", name: "Karim Hossain",photo: "", skills: ["Haircut", "Beard Trim"],  status: "available" },
    { id: "st3", name: "Sumi Begum",   photo: "", skills: ["Hair Colour", "Haircut & Blow-dry"], status: "busy" },
  ],
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function seed() {
  console.log("🌱 Seeding Firestore...");
  const salonRef = await db.collection("salons").add(sampleSalon);
  console.log(`\n✅ Salon created!`);
  console.log(`\n👉 IMPORTANT: Open apps/salon/App.js and replace:`);
  console.log(`   const SALON_ID = "REPLACE_WITH_YOUR_SALON_ID"`);
  console.log(`   with:`);
  console.log(`   const SALON_ID = "${salonRef.id}"\n`);

  await db.collection("salons").doc(salonRef.id).collection("queue").add({
    customerId: null, customerName: "Arjun K.",
    services: [{ id: "s1", name: "Haircut", durationMin: 30, price: 300 }],
    stylistId: "st1", status: "waiting", type: "walk-in",
    position: 1, estimatedWaitMin: 0,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    calledAt: null, completedAt: null,
  });

  await db.collection("salons").doc(salonRef.id).collection("queue").add({
    customerId: null, customerName: "Meera P.",
    services: [{ id: "s2", name: "Haircut & Blow-dry", durationMin: 45, price: 500 }],
    stylistId: null, status: "waiting", type: "online",
    position: 2, estimatedWaitMin: 30,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    calledAt: null, completedAt: null,
  });

  console.log("✅ Sample queue entries added.");
  console.log("🚀 Done! Run `cd apps/customer && npm install && npx expo start` to launch.\n");
}

seed().catch(console.error);
