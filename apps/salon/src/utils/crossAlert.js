// apps/salon/src/utils/crossAlert.js
// Cross-platform alert that works on both web and native.
// On web: uses window.confirm / window.alert
// On native: uses React Native's Alert

import { Platform, Alert } from "react-native";

/**
 * Show a cross-platform alert with optional confirm/cancel buttons.
 *
 * Usage:
 *   crossAlert("Title", "Message", [
 *     { text: "Cancel", style: "cancel" },
 *     { text: "OK", onPress: () => doSomething() }
 *   ]);
 */
export const crossAlert = (title, message, buttons = []) => {
  if (Platform.OS === "web") {
    // Find confirm and cancel buttons
    const confirmBtn = buttons.find((b) => b.style !== "cancel" && b.onPress);
    const cancelBtn  = buttons.find((b) => b.style === "cancel");

    if (confirmBtn && cancelBtn) {
      // Confirmation dialog
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && confirmBtn.onPress) confirmBtn.onPress();
    } else if (confirmBtn) {
      // Simple alert with one action
      window.alert(`${title}\n\n${message}`);
      if (confirmBtn.onPress) confirmBtn.onPress();
    } else {
      // Info only
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    // Native — use React Native Alert
    Alert.alert(title, message, buttons);
  }
};

/**
 * Simple info alert — no buttons needed.
 */
export const crossAlertInfo = (title, message) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};
