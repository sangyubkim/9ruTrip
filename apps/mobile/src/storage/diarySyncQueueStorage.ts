import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trip } from "../types";

const KEY = "@9rutrip/diary-sync-queue";

export type DiarySyncTask = {
  id: string;
  trip: Trip;
  createdAt: string;
};

async function loadQueue(): Promise<DiarySyncTask[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiarySyncTask[]) : [];
  } catch {
    return [];
  }
}

export async function enqueueDiarySync(trip: Trip) {
  const queue = await loadQueue();
  const task: DiarySyncTask = {
    id: `sync-diary-${trip.id}`,
    trip,
    createdAt: new Date().toISOString(),
  };
  const next = [...queue.filter((item) => item.trip.id !== trip.id), task];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function flushDiarySyncQueue(
  sync: (trip: Trip) => Promise<void>,
) {
  const queue = await loadQueue();
  const failed: DiarySyncTask[] = [];
  for (const task of queue) {
    try {
      await sync(task.trip);
    } catch {
      failed.push(task);
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(failed));
  return { synced: queue.length - failed.length, pending: failed.length };
}
