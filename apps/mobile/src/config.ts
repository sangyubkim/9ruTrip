import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MapProviderId } from "./types";
import { getCityMeta, type MvpCityId } from "./types";

/** Android 에뮬레이터에서 호스트 PC localhost */
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
