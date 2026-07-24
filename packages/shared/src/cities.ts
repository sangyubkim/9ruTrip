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
  /** 해외 = google, 국내 = naver (SDK 미연동 시 google 폴백 가능) */
  mapProvider: MapProviderId;
  region: "overseas" | "domestic";
};

export const ALL_CITY_IDS: MvpCityId[] = [
  "seoul",
  "busan",
  "jeju",
  "tokyo",
  "osaka",
];

export const DOMESTIC_CITY_IDS: MvpCityId[] = ["seoul", "busan", "jeju"];

export const OVERSEAS_CITY_IDS: MvpCityId[] = ["tokyo", "osaka"];

export function isMvpCityId(id: unknown): id is MvpCityId {
  return (
    id === "seoul" ||
    id === "busan" ||
    id === "jeju" ||
    id === "tokyo" ||
    id === "osaka"
  );
}

export function isDomesticCityId(id: unknown): boolean {
  return id === "seoul" || id === "busan" || id === "jeju";
}

/** 국내 MVP: 서울 (기본) */
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

export const BUSAN_CITY: CityMeta = {
  id: "busan",
  nameKo: "부산",
  nameEn: "Busan",
  country: "Korea",
  countryId: "kr",
  currency: "KRW",
  center: { lat: 35.1796, lng: 129.0756 },
  timezone: "Asia/Seoul",
  mapProvider: "naver",
  region: "domestic",
};

export const JEJU_CITY: CityMeta = {
  id: "jeju",
  nameKo: "제주",
  nameEn: "Jeju",
  country: "Korea",
  countryId: "kr",
  currency: "KRW",
  center: { lat: 33.4996, lng: 126.5312 },
  timezone: "Asia/Seoul",
  mapProvider: "naver",
  region: "domestic",
};

/** 해외: 도쿄 */
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

/** @deprecated use SEOUL_CITY */
export const SEOUL_STUB = { ...SEOUL_CITY, status: "stub" as const };

/**
 * 등록 도시 메타.
 * 모바일 앱의 destinations.ts 가 전체 카탈로그의 단일 소스이며,
 * shared 는 공통 헬퍼/하위 호환용 핵심 도시만 유지합니다.
 */
export const CITIES: Record<MvpCityId, CityMeta> = {
  seoul: SEOUL_CITY,
  busan: BUSAN_CITY,
  jeju: JEJU_CITY,
  tokyo: MVP_CITY,
  osaka: OSAKA_CITY,
};

export function getCity(cityId: string | undefined | null): CityMeta {
  if (cityId && isMvpCityId(cityId)) return CITIES[cityId];
  return SEOUL_CITY;
}

export function resolveMapProvider(
  cityId: string | undefined | null,
): MapProviderId {
  return getCity(cityId).mapProvider;
}
