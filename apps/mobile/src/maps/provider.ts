/**
 * 지도 프로바이더 어댑터 (모바일)
 * Google: react-native-maps PROVIDER_GOOGLE
 * Naver: 스텁 — 국내 도시용, SDK 미연동
 *
 * Android: Maps SDK는 Manifest `com.google.android.geo.API_KEY` 필수.
 * 키 없이 MapView를 마운트하면 IllegalStateException으로 크래시 → canMountNativeMap=false.
 * iOS: 키 없으면 Apple Maps(provider undefined)로 표시 가능.
 */
import { Platform } from "react-native";
import { PROVIDER_GOOGLE } from "react-native-maps";
import {
  getGoogleMapsKey,
  getNaverMapClientId,
  resolveMapProvider,
} from "../config";
import type { MapProviderId, MvpCityId } from "../types";

export type MapViewConfig = {
  providerId: MapProviderId;
  /** react-native-maps provider prop (google only) */
  rnProvider: typeof PROVIDER_GOOGLE | undefined;
  hasCredentials: boolean;
  /**
   * false면 MapView를 렌더하지 말 것 (Android 키 누락 시 크래시 방지).
   * iOS Google 키 없음 → Apple Maps로 true 유지.
   */
  canMountNativeMap: boolean;
  stubMessage: string | null;
};

export function getMapViewConfig(cityId: MvpCityId): MapViewConfig {
  const providerId = resolveMapProvider(cityId);

  if (providerId === "naver") {
    const id = getNaverMapClientId();
    return {
      providerId: "naver",
      rnProvider: undefined,
      hasCredentials: Boolean(id),
      canMountNativeMap: false,
      stubMessage: id
        ? "Naver Maps Client ID는 있으나 네이티브 모듈 미연동 (스캐폴드). 국내 도시에서 활성화 예정."
        : "Naver Maps 스텁 — EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 설정 후 국내 도시용으로 사용. 현재 해외 도시는 Google.",
    };
  }

  const key = getGoogleMapsKey();
  const hasCredentials = Boolean(key);
  // Android Google Maps SDK는 Manifest 키 없이 MapView 마운트 시 크래시
  const canMountNativeMap =
    Platform.OS !== "android" || hasCredentials;

  return {
    providerId: "google",
    rnProvider:
      Platform.OS === "android" && hasCredentials
        ? PROVIDER_GOOGLE
        : undefined,
    hasCredentials,
    canMountNativeMap,
    stubMessage: hasCredentials
      ? null
      : Platform.OS === "android"
        ? "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 미설정 — 지도 대신 목록 표시. 키 설정 후 APK 재빌드·재설치 필요"
        : "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 미설정 — Apple Maps로 표시 (Google 타일 없음)",
  };
}
