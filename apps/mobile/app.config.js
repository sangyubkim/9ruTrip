/**
 * Expo config — EXPO_PUBLIC_GOOGLE_MAPS_API_KEY → android/ios Maps apiKey
 * 로컬: apps/mobile/.env 에 키 설정 (gitignored). 없으면 빈 문자열로 graceful degrade.
 */
const mapsKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  "";

/** @type {import('expo/config').ExpoConfig} */
const expoConfig = {
  name: "9ruTrip",
  slug: "9rutrip",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#0c4a6e",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.nineru.trip",
    infoPlist: {
      NSCameraUsageDescription: "여행지 리뷰 사진을 촬영합니다.",
      NSPhotoLibraryUsageDescription: "갤러리에서 여행 사진을 선택합니다.",
      NSLocationWhenInUseUsageDescription:
        "일정 지도 표시와 경로 이탈 시 재루트 안내에 사용합니다.",
    },
    config: {
      googleMapsApiKey: mapsKey,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0c4a6e",
    },
    package: "com.nineru.trip",
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "POST_NOTIFICATIONS",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
    config: {
      googleMaps: {
        apiKey: mapsKey,
      },
    },
    // 다른 앱에서 텍스트(SMS 전문 등) 공유 수신 — 커스텀/dev 빌드에서 유효
    intentFilters: [
      {
        action: "SEND",
        category: ["DEFAULT"],
        data: [{ mimeType: "text/plain" }],
      },
    ],
  },
  plugins: [
    [
      "expo-image-picker",
      {
        photosPermission: "갤러리에서 여행 사진을 선택합니다.",
        cameraPermission: "카메라로 여행 사진을 촬영합니다.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "일정 지도 표시와 경로 이탈 시 재루트 안내에 사용합니다.",
      },
    ],
    [
      "expo-notifications",
      {
        color: "#0c4a6e",
        defaultChannel: "guide-alarms",
      },
    ],
    "react-native-maps",
  ],
  extra: {
    googleMapsApiKey: mapsKey,
    naverMapClientId:
      process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ||
      process.env.NAVER_MAP_CLIENT_ID?.trim() ||
      "",
    mapProviderDefault: "google",
  },
};

export default { expo: expoConfig };
