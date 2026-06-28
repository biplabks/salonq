// apps/customer/src/services/notifications.js
// Handles push notification registration and receiving.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// Key used to store the scheduled reminder notification ID in AsyncStorage.
export const REMINDER_NOTIF_KEY  = "reminderNotifId";
export const REMINDER_ENABLED_KEY = "reminderEnabled";

/**
 * Request permission and get the Expo push token.
 * Returns the token string or null if permission denied.
 */
export const registerForPushNotifications = async () => {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device.");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied.");
    return null;
  }

  // Android channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("salonq", {
      name:             "SalonQ Queue Updates",
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       "#1a1a2e",
      sound:            true,
    });
  }

  // Get Expo push token
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "salonq-5c956", // your Expo project ID
    });
    return token.data;
  } catch (err) {
    console.error("Failed to get push token:", err);
    return null;
  }
};

/**
 * Save the push token to a queue entry in Firestore.
 * Called after customer joins queue.
 */
export const savePushToken = async (salonId, entryId, token) => {
  if (!token) return;
  try {
    await updateDoc(doc(db, "salons", salonId, "queue", entryId), {
      pushToken: token,
    });
    console.log("✅ Push token saved to queue entry");
  } catch (err) {
    console.error("Failed to save push token:", err);
  }
};

/**
 * Set up notification listeners.
 * - onReceive: called when notification arrives while app is open
 * - onTap: called when user taps a notification
 */
export const setupNotificationListeners = (onReceive, onTap) => {
  const receiveListener = Notifications.addNotificationReceivedListener(onReceive);
  const tapListener     = Notifications.addNotificationResponseReceivedListener(
    (response) => onTap(response.notification)
  );

  return () => {
    receiveListener.remove();
    tapListener.remove();
  };
};

/**
 * Schedule a local "heads-up" reminder firing (estimatedWaitMin - 10) minutes from now.
 * Returns the notification ID, or null if not applicable.
 */
export const scheduleReminderNotification = async (estimatedWaitMin) => {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  if (!estimatedWaitMin || estimatedWaitMin <= 10) return null;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return null;

  try {
    const delaySec = (estimatedWaitMin - 10) * 60;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Time to head over!",
        body:  "Your turn is coming up in about 10 minutes. Start making your way to the salon.",
        sound: true,
        channelId: "salonq",
      },
      trigger: { seconds: delaySec },
    });
    return id;
  } catch (err) {
    console.warn("Failed to schedule reminder:", err);
    return null;
  }
};

/**
 * Cancel a previously scheduled reminder by its notification ID.
 */
export const cancelReminderNotification = async (notifId) => {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch (err) {
    console.warn("Could not cancel reminder:", err);
  }
};
