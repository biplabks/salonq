// apps/salon/app.config.js
export default {
  expo: {
    name: "SalonQ Dashboard",
    slug: "salonq-salon",
    scheme: "salonq-salon",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.salonq.salon",
    },
    android: {
      package: "com.salonq.salon",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a1a2e",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      name: "SalonQ Dashboard",
      shortName: "SalonQ",
      description: "Manage your salon queue and operations",
      themeColor: "#1a1a2e",
      backgroundColor: "#1a1a2e",
      lang: "en",
      display: "standalone",
    },
  },
};
