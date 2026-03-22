// scripts/clear-database.js
// Clears ALL data from Firestore for a fresh start
// Run with: node scripts/clear-database.js

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");

// ── IMPORTANT: You need a service account key to run this ─────────────────────
// 1. Go to Firebase Console → Project Settings → Service accounts
// 2. Click "Generate new private key"
// 3. Save the file as "serviceAccountKey.json" in the root of your project
// 4. Make sure it's in .gitignore (NEVER commit this file)
// ─────────────────────────────────────────────────────────────────────────────

let serviceAccount;
try {
  serviceAccount = require("./service-account.json");
} catch (e) {
  console.error("❌ service-account not found!");
  console.error("   1. Go to Firebase Console → Project Settings → Service accounts");
  console.error("   2. Click 'Generate new private key'");
  console.error("   3. Save as serviceAccountKey.json in project root");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Delete all documents in a collection ─────────────────────────────────────
async function deleteCollection(collectionPath, batchSize = 50) {
  const ref   = db.collection(collectionPath);
  const snap  = await ref.limit(batchSize).get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Recurse if there are more
  if (snap.size === batchSize) {
    return snap.size + await deleteCollection(collectionPath, batchSize);
  }
  return snap.size;
}

// ── Delete subcollections of each salon ──────────────────────────────────────
async function deleteSalonSubcollections(salonId) {
  const subcollections = ["queue", "reviews"];
  for (const sub of subcollections) {
    const count = await deleteCollection(`salons/${salonId}/${sub}`);
    if (count > 0) console.log(`   ✓ Deleted ${count} ${sub} entries`);
  }
}

// ── Delete subcollections of each customer ────────────────────────────────────
async function deleteCustomerSubcollections(customerId) {
  const count = await deleteCollection(`customers/${customerId}/visits`);
  if (count > 0) console.log(`   ✓ Deleted ${count} visits for customer ${customerId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function clearDatabase() {
  console.log("🗑️  Starting database clear...\n");
  console.log("⚠️  This will delete ALL data. Press Ctrl+C within 5 seconds to cancel.\n");

  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    // 1. Clear salon subcollections first
    console.log("📋 Clearing salons...");
    const salonsSnap = await db.collection("salons").get();
    for (const salonDoc of salonsSnap.docs) {
      console.log(`   Salon: ${salonDoc.data().name || salonDoc.id}`);
      await deleteSalonSubcollections(salonDoc.id);
    }
    const salonCount = await deleteCollection("salons");
    console.log(`   ✓ Deleted ${salonCount} salons\n`);

    // 2. Clear customer subcollections + customers
    console.log("👤 Clearing customers...");
    const customersSnap = await db.collection("customers").get();
    for (const customerDoc of customersSnap.docs) {
      await deleteCustomerSubcollections(customerDoc.id);
    }
    const customerCount = await deleteCollection("customers");
    console.log(`   ✓ Deleted ${customerCount} customers\n`);

    // 3. Clear salon staff
    console.log("👥 Clearing salon staff...");
    const staffCount = await deleteCollection("salonStaff");
    console.log(`   ✓ Deleted ${staffCount} staff records\n`);

    // 4. Clear Firebase Auth users — cannot be done via Firestore SDK
    // You need to delete users manually in Firebase Console → Authentication

    console.log("✅ Database cleared successfully!\n");
    console.log("⚠️  NOTE: Firebase Auth users are NOT deleted by this script.");
    console.log("   To delete auth users: Firebase Console → Authentication → Users → Select all → Delete\n");
    console.log("🚀 You can now start fresh!");

  } catch (err) {
    console.error("❌ Error clearing database:", err.message);
    process.exit(1);
  }
}

clearDatabase();
