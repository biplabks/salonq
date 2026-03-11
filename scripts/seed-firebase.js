// scripts/seed-firebase.js
// Run this ONCE to populate your Firestore with a sample salon.
// Usage: node scripts/seed-firebase.js
//
// Prerequisites:
//   npm install firebase-admin
//   Set GOOGLE_APPLICATION_CREDENTIALS env variable to your service account JSON path

const admin = require("firebase-admin");

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Download your service account key from Firebase Console → Project Settings → Service accounts
const serviceAccount = require("./service-account.json"); // ← add your file here

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const sampleSalon = {
  name:    "Style Studio",
  address: "123 Main Street, New Delhi, Delhi",
  city:    "New Delhi",
  phone:   "+91 98765 43210",
  photos:  [],
  location: { lat: 28.6139, lng: 77.2090 },
  avgWaitMin: 20,
  queueCount: 3,
  isOpen: true,
  hours: {
    mon: { open: "09:00", close: "19:00", closed: false },
    tue: { open: "09:00", close: "19:00", closed: false },
    wed: { open: "09:00", close: "19:00", closed: false },
    thu: { open: "09:00", close: "19:00", closed: false },
    fri: { open: "09:00", close: "20:00", closed: false },
    sat: { open: "09:00", close: "18:00", closed: false },
    sun: { open: "10:00", close: "16:00", closed: false },
  },
  services: [
    { id: "s1", name: "Haircut",            price: 500,  durationMin: 30,  category: "Hair" },
    { id: "s2", name: "Haircut & Blow-dry", price: 800,  durationMin: 45,  category: "Hair" },
    { id: "s3", name: "Hair Colour",        price: 2500, durationMin: 90,  category: "Colour" },
    { id: "s4", name: "Head Massage",       price: 400,  durationMin: 20,  category: "Treatment" },
    { id: "s5", name: "Beard Trim",         price: 200,  durationMin: 15,  category: "Grooming" },
    { id: "s6", name: "Manicure",           price: 600,  durationMin: 40,  category: "Nails" },
  ],
  stylists: [
    { id: "st1", name: "Priya Sharma",  photo: "", skills: ["Haircut", "Hair Colour", "Head Massage"], status: "available" },
    { id: "st2", name: "Rahul Verma",   photo: "", skills: ["Haircut", "Beard Trim"],                  status: "busy" },
    { id: "st3", name: "Anjali Mehta",  photo: "", skills: ["Manicure", "Haircut & Blow-dry"],         status: "available" },
  ],
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function seed() {
  console.log("🌱 Seeding Firestore...");

  // Create salon
  const salonRef = await db.collection("salons").add(sampleSalon);
  console.log(`✅ Salon created: ${salonRef.id}`);
  console.log(`\n⚠️  Important: Update SALON_ID in apps/salon/App.js to: "${salonRef.id}"\n`);

  // Add some sample queue entries
  const queueEntries = [
    {
      customerId:   null,
      customerName: "Arjun K.",
      services:     [{ id: "s1", name: "Haircut", durationMin: 30, price: 500 }],
      stylistId:    "st1",
      status:       "waiting",
      type:         "walk-in",
      position:     1,
      estimatedWaitMin: 10,
      joinedAt:     admin.firestore.FieldValue.serverTimestamp(),
      calledAt:     null,
      completedAt:  null,
    },
    {
      customerId:   null,
      customerName: "Meera P.",
      services:     [{ id: "s2", name: "Haircut & Blow-dry", durationMin: 45, price: 800 }],
      stylistId:    null,
      status:       "waiting",
      type:         "online",
      position:     2,
      estimatedWaitMin: 40,
      joinedAt:     admin.firestore.FieldValue.serverTimestamp(),
      calledAt:     null,
      completedAt:  null,
    },
  ];

  for (const entry of queueEntries) {
    await db.collection("salons").doc(salonRef.id).collection("queue").add(entry);
  }
  console.log("✅ Sample queue entries created");
  console.log("\n🚀 Done! Your Firebase is ready.");
}

seed().catch(console.error);
