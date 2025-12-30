const IS_PROD = process.env.NODE_ENV === 'production' || process.env.EXPO_BASE_URL;

export default {
  expo: {
    name: "NShapes",
    slug: "nshapes",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "nshapes",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.nshapes.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.nshapes.app"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
      icon: "./assets/icon.png",
      name: "NShapes",
      shortName: "NShapes",
      description: "A roguelike deckbuilding match-three puzzle game",
      backgroundColor: "#ffffff",
      themeColor: "#000000",
      display: "standalone",
      orientation: "portrait",
      startUrl: IS_PROD ? "/nshapes/" : "/",
      scope: IS_PROD ? "/nshapes/" : "/"
    },
    plugins: [
      "expo-router",
      "expo-asset"
    ],
    experiments: {
      typedRoutes: true,
      ...(IS_PROD && { baseUrl: "/nshapes" })
    }
  }
};
