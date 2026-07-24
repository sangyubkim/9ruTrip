/**
 * Expo config — EXPO_PUBLIC_GOOGLE_MAPS_API_KEY → android/ios Maps apiKey
 * 로컬: apps/mobile/.env 에 키 설정 (gitignored).
 * 키가 있을 때만 Manifest meta-data 주입 (빈 키로 넣지 않음).
 * 없으면 JS에서 MapView 미마운트 → graceful degrade (재빌드 필요: Manifest는 빌드 타임).
 *
 * USB 실기기: Expo Go 대신 expo-dev-client 개발 빌드
 *   → docs/ANDROID-USB-BUILD.md · npm run android:usb
 */
const mapsKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  "";

const easProjectId = process.env.EAS_PROJECT_ID?.trim();

/** @type {import('expo/config').ExpoConfig} */
const expoConfig = {
  name: "9ruTrip",
  slug: "9rutrip",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  scheme: "9rutrip",
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
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
    ...(mapsKey
      ? {
          config: {
            googleMapsApiKey: mapsKey,
          },
        }
      : {}),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0c4a6e",
    },
    package: "com.nineru.trip",
    // 키보드가 열릴 때 레이아웃을 줄여 ScrollView가 포커스 필드를 올릴 수 있게 함
    softwareKeyboardLayoutMode: "resize",
    // 로컬 API(http://LAN:3011) 실기기 디버그용
    usesCleartextTraffic: true,
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
    ...(mapsKey
      ? {
          config: {
            googleMaps: {
              apiKey: mapsKey,
            },
          },
        }
      : {}),
    // 다른 앱에서 텍스트(SMS 전문 등) 공유 진입 — 커스텀/dev 빌드에서 유효
    intentFilters: [
      {
        action: "SEND",
        category: ["DEFAULT"],
        data: [{ mimeType: "text/plain" }],
      },
    ],
  },
  plugins: [
    "expo-dev-client",
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
    // Expo SDK: Manifest geo.API_KEY 는 플러그인 옵션으로 주입 (android.config 만으로는 누락될 수 있음)
    mapsKey
      ? [
          "react-native-maps",
          {
            androidGoogleMapsApiKey: mapsKey,
            iosGoogleMapsApiKey: mapsKey,
          },
        ]
      : "react-native-maps",
  ],
  extra: {
    googleMapsApiKey: mapsKey,
    naverMapClientId:
      process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ||
      process.env.NAVER_MAP_CLIENT_ID?.trim() ||
      "",
    mapProviderDefault: "google",
    ...(easProjectId
      ? { eas: { projectId: easProjectId } }
      : {}),
  },
};

export default { expo: expoConfig };
