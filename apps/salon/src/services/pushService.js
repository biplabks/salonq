// apps/salon/src/services/pushService.js
// Sends push notifications to customers via Expo Push API.
// Called from the salon dashboard when queue status changes.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send a push notification to a single customer.
 * @param {string} pushToken - Customer's Expo push token
 * @param {string} title     - Notification title
 * @param {string} body      - Notification body
 * @param {object} data      - Extra data (salonId, entryId, etc.)
 */
export const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    console.log("Invalid or missing push token — skipping notification");
    return;
  }

  const message = {
    to:    pushToken,
    sound: "default",
    title,
    body,
    data,
    priority:    "high",
    channelId:   "salonq",
    badge:       1,
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "Accept":          "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (result.data?.status === "error") {
      console.error("Push notification error:", result.data.message);
    } else {
      console.log("✅ Push notification sent:", title);
    }
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
};

/**
 * Send notifications to multiple customers at once.
 * Used when queue reorders (position changes).
 */
export const sendBulkPushNotifications = async (messages) => {
  const valid = messages.filter(
    (m) => m.pushToken && m.pushToken.startsWith("ExponentPushToken")
  );
  if (!valid.length) return;

  const payload = valid.map((m) => ({
    to:        m.pushToken,
    sound:     "default",
    title:     m.title,
    body:      m.body,
    data:      m.data || {},
    priority:  "high",
    channelId: "salonq",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log(`✅ Bulk notifications sent: ${valid.length} messages`);
    return result;
  } catch (err) {
    console.error("Bulk push notification error:", err);
  }
};

// ── Notification templates ────────────────────────────────────────────────────

export const NOTIFICATIONS = {
  called: (salonName) => ({
    title: "✂️ You're being called!",
    body:  `${salonName} is ready for you. Head over now!`,
  }),

  youreNext: (salonName) => ({
    title: "🔔 You're next!",
    body:  `Get ready — ${salonName} will call you very soon.`,
  }),

  positionUpdate: (position, waitMin) => ({
    title: `📍 Queue update — you're #${position}`,
    body:  waitMin > 0
      ? `Estimated wait: ${waitMin} min. Stay close!`
      : "Almost your turn!",
  }),

  queueEmpty: (salonName) => ({
    title: "🎉 Queue is clear!",
    body:  `${salonName} is ready to serve you right now.`,
  }),
};
