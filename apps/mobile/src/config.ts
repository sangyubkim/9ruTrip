import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MapProviderId } from "./types";
import { getCityMeta, type MvpCityId } from "./types";

/**
 * API base URL
 * - `.env` EXPO_PUBLIC_API_BASE_URL 우선
 *   · LAN: http://192.168.x.x:3011
 *   · 외부: https://…cloudwaysapps.com/apps/api  (docs/CLOUDWAYS.md)
 * - 미설정 Android 기본값 10.0.2.2 = 에뮬레이터→호스트 (실기기에서는 동작 안 함)
 * - 안내: apps/mobile/docs/ANDROID-USB-BUILD.md · docs/CLOUDWAYS.md
 */
function defaultApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "android") return "http://10.0.2.2:3011";
  return "http://localhost:3011";
}

export const DEFAULT_API_BASE_URL = defaultApiBase();

export function getGoogleMapsKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)
      ?.googleMapsApiKey ||
    ""
  );
}

export function getNaverMapClientId(): string {
  return (
    process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ||
    (Constants.expoConfig?.extra as { naverMapClientId?: string } | undefined)
      ?.naverMapClientId ||
    ""
  );
}

export function resolveMapProvider(cityId: MvpCityId): MapProviderId {
  return getCityMeta(cityId).mapProvider;
}
