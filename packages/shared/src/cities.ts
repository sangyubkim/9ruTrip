import type { MvpCityId } from "./types.js";

export type CityMeta = {
  id: MvpCityId;
  nameKo: string;
  nameEn: string;
  country: string;
  currency: "JPY";
  center: { lat: number; lng: number };
  timezone: string;
  mapProvider: "google";
};

/** MVP: 해외 1개 도시 — 도쿄 (음식+관광 밸런스) */
export const MVP_CITY: CityMeta = {
  id: "tokyo",
  nameKo: "도쿄",
  nameEn: "Tokyo",
  country: "Japan",
  currency: "JPY",
  center: { lat: 35.681236, lng: 139.767125 },
  timezone: "Asia/Tokyo",
  mapProvider: "google",
};

export const CITIES: Record<MvpCityId, CityMeta> = {
  tokyo: MVP_CITY,
};
