/**
 * 지도 프로바이더 어댑터 (모바일)
 * Google: react-native-maps PROVIDER_GOOGLE
 * Naver: 스텁 — 국내 도시용, SDK 미연동
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
      stubMessage: id
        ? "Naver Maps Client ID는 있으나 네이티브 모듈 미연동 (스캐폴드). 국내 도시에서 활성화 예정."
        : "Naver Maps 스텁 — EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 설정 후 국내 도시용으로 사용. 현재 해외 도시는 Google.",
    };
  }

  const key = getGoogleMapsKey();
  return {
    providerId: "google",
    rnProvider: Platform.OS === "android" ? PROVIDER_GOOGLE : undefined,
    hasCredentials: Boolean(key),
    stubMessage: key
      ? null
      : "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 미설정 — 기기 기본 지도/제한 모드일 수 있음 (앱은 계속 동작)",
  };
}
