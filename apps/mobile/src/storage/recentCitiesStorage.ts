import AsyncStorage from "@react-native-async-storage/async-storage";
import { isKnownCityId } from "../data/destinations";
import type { MvpCityId } from "../types";

const KEY = "@9rutrip/recent-cities";
const MAX_RECENT = 8;

export async function loadRecentCities(): Promise<MvpCityId[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string" && isKnownCityId(id))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** 선택한 도시를 최근 목록 맨 앞에 저장 (중복 제거, 최대 MAX_RECENT) */
export async function pushRecentCities(
  cityIds: MvpCityId[],
): Promise<MvpCityId[]> {
  const incoming = [...new Set(cityIds.filter((id) => isKnownCityId(id)))];
  const prev = await loadRecentCities();
  const next = [
    ...incoming,
    ...prev.filter((id) => !incoming.includes(id)),
  ].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
