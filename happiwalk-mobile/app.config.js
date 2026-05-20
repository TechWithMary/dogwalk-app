module.exports = {
  expo: {
    name: "HappiWalk",
    slug: "happiwalk",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "happiwalk",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#13ec13",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.happiwalk.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "HappiWalk necesita tu ubicación para mostrar tu posición durante los paseos",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "HappiWalk necesita tu ubicación para rastrear el paseo de tu mascota",
        NSCameraUsageDescription:
          "HappiWalk necesita acceso a la cámara para tomar fotos de tu mascota",
        NSPhotoLibraryUsageDescription:
          "HappiWalk necesita acceso a tus fotos para seleccionar imágenes de tu mascota",
      },
      entitlements: {
        "aps-environment": "development",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#13ec13",
      },
      package: "com.happiwalk.app",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "HappiWalk necesita tu ubicación para rastrear el paseo de tu mascota.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "HappiWalk necesita acceso a tus fotos para seleccionar imágenes de tu mascota.",
          cameraPermission:
            "HappiWalk necesita acceso a la cámara para tomar fotos.",
        },
      ],
      "expo-asset",
      "expo-font",
      "expo-web-browser",
    ],
    extra: {
      eas: {
        projectId: "eee18f9b-4b7e-4fae-a250-5e7b87929438",
      },
    },
  },
};