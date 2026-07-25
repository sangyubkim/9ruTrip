import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TravelDiaryEntry } from "../types";

const KEY = "@9rutrip/diary";

export async function loadDiaryEntries(): Promise<TravelDiaryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TravelDiaryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function upsertDiaryEntry(
  entry: TravelDiaryEntry,
): Promise<TravelDiaryEntry[]> {
  const entries = await loadDiaryEntries();
  const index = entries.findIndex((item) => item.tripId === entry.tripId);
  const next =
    index < 0
      ? [entry, ...entries]
      : entries.map((item, i) => (i === index ? { ...item, ...entry } : item));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeDiaryEntry(id: string): Promise<TravelDiaryEntry[]> {
  const next = (await loadDiaryEntries()).filter((entry) => entry.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
