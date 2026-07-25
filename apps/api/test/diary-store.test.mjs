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
    places: [{ name: "경복궁" }, { name: "북촌" }],
  };

  const created = await store.upsertFromTrip(trip);
  assert.equal(created.tripId, trip.id);
  assert.equal(created.placeCount, 2);
  assert.equal((await store.list("2026")).length, 1);
  assert.equal((await store.list("2025")).length, 0);

  const restartedStore = createDiaryStore(filePath);
  const updated = await restartedStore.update(created.id, { notes: "비 오는 날의 서울" });
  assert.equal(updated.notes, "비 오는 날의 서울");
  assert.match(await readFile(filePath, "utf8"), /비 오는 날의 서울/);
});
