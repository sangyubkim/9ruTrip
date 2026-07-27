import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDiaryStore } from "../lib/diary-store.mjs";

test("완료 여행 다이어리를 디스크에 upsert하고 연도별로 조회한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "9rutrip-diary-"));
  const filePath = join(dir, "diary.json");
  const store = createDiaryStore(filePath);
  const trip = {
    id: "trip-2026",
    cityId: "seoul",
    cityName: "서울",
    nights: 2,
    days: 3,
    partySize: 2,
    plannedBudget: 300000,
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    status: "done",
    updatedAt: "2026-07-03T10:00:00.000Z",
    briefing: "서울 고궁과 골목을 느긋하게 도는 일정입니다.",
    routeOutline: "서울역 → 서울 → 서울역",
    places: [
      {
        id: "p1",
        name: "경복궁",
        category: "attraction",
        lat: 37.5796,
        lng: 126.977,
        dayIndex: 0,
        order: 0,
        notes: "오전 관람",
      },
      {
        id: "p2",
        name: "북촌",
        category: "attraction",
        lat: 37.5826,
        lng: 126.983,
        dayIndex: 0,
        order: 1,
        travelFromPrevMinutes: 18,
      },
    ],
  };

  const created = await store.upsertFromTrip(trip);
  assert.equal(created.tripId, trip.id);
  assert.equal(created.placeCount, 2);
  assert.equal(created.places?.length, 2);
  assert.equal(created.briefing, trip.briefing);
  assert.equal(created.routeOutline, trip.routeOutline);
  assert.equal((await store.list("2026")).length, 1);
  assert.equal((await store.list("2025")).length, 0);

  const restartedStore = createDiaryStore(filePath);
  const updated = await restartedStore.update(created.id, { notes: "비 오는 날의 서울" });
  assert.equal(updated.notes, "비 오는 날의 서울");
  assert.match(await readFile(filePath, "utf8"), /비 오는 날의 서울/);

  assert.equal(await restartedStore.remove(created.id), true);
  assert.equal((await restartedStore.list("2026")).length, 0);
  assert.equal(await restartedStore.remove(created.id), false);
});
