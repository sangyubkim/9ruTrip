import type { MapProviderId, MvpCityId } from "./types.js";

export type CityMeta = {
  id: MvpCityId;
  nameKo: string;
  nameEn: string;
  country: string;
  countryId?: string;
  currency: string;
  center: { lat: number; lng: number };
  timezone: string;
  /** 해외 = google, 국내 = naver */
  mapProvider: MapProviderId;
  region: "overseas" | "domestic";
};

/** MVP 기본 도시 */
export const MVP_CITY: CityMeta = {
  id: "tokyo",
  nameKo: "도쿄",
  nameEn: "Tokyo",
  country: "Japan",
  countryId: "jp",
  currency: "JPY",
  center: { lat: 35.681236, lng: 139.767125 },
  timezone: "Asia/Tokyo",
  mapProvider: "google",
  region: "overseas",
};

export const OSAKA_CITY: CityMeta = {
  id: "osaka",
  nameKo: "오사카",
  nameEn: "Osaka",
  country: "Japan",
  countryId: "jp",
  currency: "JPY",
  center: { lat: 34.6937, lng: 135.5023 },
  timezone: "Asia/Tokyo",
  mapProvider: "google",
  region: "overseas",
};

export const SEOUL_CITY: CityMeta = {
  id: "seoul",
  nameKo: "서울",
  nameEn: "Seoul",
  country: "Korea",
  countryId: "kr",
  currency: "KRW",
  center: { lat: 37.5665, lng: 126.978 },
  timezone: "Asia/Seoul",
  mapProvider: "naver",
  region: "domestic",
};

/** @deprecated use SEOUL_CITY */
export const SEOUL_STUB = { ...SEOUL_CITY, status: "stub" as const };

/**
 * 등록 도시 메타.
 * 모바일 앱의 destinations.ts 가 전체 카탈로그의 단일 소스이며,
 * shared 는 공통 헬퍼/하위 호환용 핵심 도시만 유지합니다.
 */
export const CITIES: Record<string, CityMeta> = {
  tokyo: MVP_CITY,
  osaka: OSAKA_CITY,
  seoul: SEOUL_CITY,
};

export function getCity(cityId: string | undefined | null): CityMeta {
  if (cityId && CITIES[cityId]) return CITIES[cityId];
  return MVP_CITY;
}

export function resolveMapProvider(cityId: string | undefined | null): MapProviderId {
  return getCity(cityId).mapProvider;
}
