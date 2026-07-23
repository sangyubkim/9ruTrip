/**
 * 지도 프로바이더 추상화
 * - google: 해외 (도쿄/오사카)
 * - naver: 국내 (스텁 — NAVER_MAP_CLIENT_ID 준비 후 연동)
 */

import type { MapProviderId } from "./types.js";
import { resolveMapProvider } from "./cities.js";

export type MapAdapterCapability = {
  id: MapProviderId;
  label: string;
  ready: boolean;
  notes: string;
};

export function describeMapAdapter(
  provider: MapProviderId,
  env: { googleKey?: string; naverClientId?: string } = {},
): MapAdapterCapability {
  if (provider === "naver") {
    const ready = Boolean(env.naverClientId);
    return {
      id: "naver",
      label: "Naver Maps",
      ready,
      notes: ready
        ? "Client ID 설정됨 — 네이티브 모듈 연동 필요"
        : "스텁: NAVER_MAP_CLIENT_ID / EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 설정 후 국내 도시용",
    };
  }
  return {
    id: "google",
    label: "Google Maps",
    ready: Boolean(env.googleKey),
    notes: env.googleKey
      ? "API 키 설정됨"
      : "키 없으면 Expo Go/기기 기본 지도로 graceful degrade",
  };
}

export function mapProviderForCity(cityId: string | undefined | null): MapProviderId {
  return resolveMapProvider(cityId);
}

export * from "./cities.js";
