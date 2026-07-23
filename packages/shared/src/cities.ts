import type { MapProviderId, MvpCityId } from "./types.js";

export type CityMeta = {
  id: MvpCityId;
  nameKo: string;
  nameEn: string;
  country: string;
  currency: "JPY";
  center: { lat: number; lng: number };
  timezone: string;
  /** 해외 = google, 국내(향후) = naver */
  mapProvider: MapProviderId;
  region: "overseas" | "domestic";
};

/** MVP: 해외 도쿄 (기본) */
export const MVP_CITY: CityMeta = {
  id: "tokyo",
  nameKo: "도쿄",
  nameEn: "Tokyo",
  country: "Japan",
  currency: "JPY",
  center: { lat: 35.681236, lng: 139.767125 },
  timezone: "Asia/Tokyo",
  mapProvider: "google",
  region: "overseas",
};

/** P2: 해외 2번째 도시 (선택) — Google Maps */
export const OSAKA_CITY: CityMeta = {
  id: "osaka",
  nameKo: "오사카",
  nameEn: "Osaka",
  country: "Japan",
  currency: "JPY",
  center: { lat: 34.6937, lng: 135.5023 },
  timezone: "Asia/Tokyo",
  mapProvider: "google",
  region: "overseas",
};

/**
 * 국내 도시 자리표시 (Naver Maps) — 키/SDK 연동 전 스텁
 * 실제 cityId 로는 아직 선택 불가
 */
export const SEOUL_STUB = {
  id: "seoul" as const,
  nameKo: "서울",
  nameEn: "Seoul",
  country: "Korea",
  currency: "KRW" as const,
  center: { lat: 37.5665, lng: 126.978 },
  timezone: "Asia/Seoul",
  mapProvider: "naver" as const,
  region: "domestic" as const,
  status: "stub" as const,
};

export const CITIES: Record<MvpCityId, CityMeta> = {
  tokyo: MVP_CITY,
  osaka: OSAKA_CITY,
};

export function getCity(cityId: string | undefined | null): CityMeta {
  if (cityId === "osaka") return OSAKA_CITY;
  return MVP_CITY;
}

export function resolveMapProvider(cityId: string | undefined | null): MapProviderId {
  return getCity(cityId).mapProvider;
}
