# ✂️ SalonQ — Salon Queue Management System

A full-stack mobile + web app that lets customers find salons, join queues remotely, and get real-time updates. Salons get a live dashboard to manage their queue, staff, and services.

---

## 📁 Project Structure

```
salonq/
├── apps/
│   ├── customer/          ← Customer-facing iOS/Android/Web app (Expo)
│   │   └── src/
│   │       ├── screens/
│   │       │   ├── LoginScreen.js        – Sign in / register
│   │       │   ├── HomeScreen.js         – Discover nearby salons
│   │       │   ├── SalonDetailScreen.js  – Salon info, services, stylists
│   │       │   ├── CheckInScreen.js      – 3-step check-in flow
│   │       │   ├── QueueTrackerScreen.js – Live queue position tracker
│   │       │   ├── ProfileScreen.js      – Account & family members
│   │       │   └── HistoryScreen.js      – Visit history & receipts
│   │       ├── hooks/
│   │       │   ├── useAuth.js            – Firebase auth state
│   │       │   └── useQueue.js           – Real-time queue subscriptions
│   │       └── navigation/index.js       – App navigation structure
│   │
│   └── salon/             ← Salon staff dashboard (Expo / tablet)
│       ├── App.js
│       └── src/screens/
│           ├── SalonLogin.js             – Staff sign-in
│           ├── QueueDashboard.js         – Live queue management
│           └── StylistBoard.js           – Stylist status & availability
│
├── packages/
│   └── shared/            ← Shared code used by both apps
│       ├── firebase/
│       │   ├── config.js  – Your Firebase credentials go here
│       │   └── index.js   – All Firebase helpers (auth, queue, salon, etc.)
│       ├── models/        – Data type definitions & constants
│       └── utils/         – Formatters, distance, wait time calculations
│
├── scripts/
│   └── seed-firebase.js   – One-time script to populate sample data
├── firestore.rules        – Firestore security rules
└── package.json           – Monorepo root
```

---

## 🚀 Getting Started

### Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `salonq`
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Firestore Database** → Start in **test mode**
5. Go to **Project Settings** → Your apps → Add a **Web app**
6. Copy the config values

### Step 2 — Add Your Firebase Config

Open `packages/shared/firebase/config.js` and replace the placeholder values:

```js
export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

### Step 3 — Install Dependencies

```bash
npm install         # Install root dependencies
cd apps/customer && npm install
cd apps/salon    && npm install
```

### Step 4 — Seed Sample Data (Optional)

```bash
# Install firebase-admin
npm install -g firebase-admin

# Download your service account key from Firebase Console
# Project Settings → Service accounts → Generate new private key
# Save as scripts/service-account.json

node scripts/seed-firebase.js
```

Copy the printed Salon ID and update `apps/salon/App.js`:
```js
const SALON_ID = "PASTE_YOUR_SALON_ID_HERE";
```

### Step 5 — Run the Apps

**Customer App:**
```bash
cd apps/customer
npx expo start
```

**Salon Dashboard:**
```bash
cd apps/salon
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `w` for web.

---

## 🗄️ Firestore Data Structure

```
salons/
  {salonId}/
    name, address, city, phone, hours, services[], stylists[]
    avgWaitMin, queueCount, location: { lat, lng }
    
    queue/
      {entryId}/
        customerId, customerName
        services[], stylistId
        status: "waiting" | "called" | "in-service" | "done" | "no-show"
        type: "online" | "walk-in"
        position, estimatedWaitMin
        joinedAt, calledAt, completedAt

customers/
  {userId}/
    name, email, phone, familyMembers[]
    
    visits/
      {visitId}/
        salonId, stylistId, services[], totalPrice, completedAt
```

---

## 🔐 Deploying Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## 🗺️ What's Built (Phase 1 MVP)

| Feature | Status |
|---|---|
| Customer login / registration | ✅ |
| Salon discovery list | ✅ |
| Salon detail (services, stylists, hours) | ✅ |
| 3-step online check-in | ✅ |
| Real-time queue position tracker | ✅ |
| Leave queue | ✅ |
| Salon live queue dashboard | ✅ |
| Call next / Start service / Mark done | ✅ |
| Walk-in entry (salon side) | ✅ |
| No-show handling | ✅ |
| Stylist availability board | ✅ |
| Visit history | ✅ |
| Wait time estimation | ✅ |

## 🗺️ Coming Next (Phase 2)

| Feature | Notes |
|---|---|
| Push notifications | Expo Notifications + Firebase Cloud Messaging |
| Map view of salons | react-native-maps + Google Maps API |
| Family member check-in | Add family members to queue |
| Payments & deposits | Stripe integration |
| Promo codes | Firestore promo collection |
| Analytics dashboard | Daily stats, avg wait, revenue |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Customer App | React Native + Expo |
| Salon Dashboard | React Native + Expo (tablet) |
| Backend | Firebase (Firestore + Auth) |
| Real-time | Firestore `onSnapshot` listeners |
| Navigation | React Navigation v6 |
| State | React hooks (useState, useEffect) |
| Shared code | npm workspaces monorepo |

---

## 🤔 Next Steps

Once you've got the app running:

1. **Test the full flow** — register a customer, discover the salon, check in, then switch to the salon dashboard and call them through
2. **Customise the sample salon** with your real services and stylists via the seed script or directly in Firestore
3. **Add push notifications** — see `expo-notifications` docs
4. **Deploy the web version** — run `expo export:web` in the customer app

Happy building! ✂️
