import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMinutesToHhmm,
  hhmmToMinutes,
  shiftPlannedTimesByDelta,
} from "./shiftPlannedTimes.ts";

describe("shiftPlannedTimesByDelta", () => {
  const places = [
    { id: "a", dayIndex: 0, plannedTime: "10:00" },
    { id: "b", dayIndex: 0, plannedTime: "12:00" },
    { id: "c", dayIndex: 0, plannedTime: "14:00" },
    { id: "h", dayIndex: 0, plannedTime: "21:00" },
    { id: "d1", dayIndex: 1, plannedTime: "10:00" },
  ];

  it("shifts incomplete places before and after by the same delta", () => {
    // b: 12:00 → 13:47 (+107), then shift others; b already set so excluded
    const edited = places.map((p) =>
      p.id === "b" ? { ...p, plannedTime: "13:47" } : p,
    );
    const delta = hhmmToMinutes("13:47") - hhmmToMinutes("12:00");
    assert.equal(delta, 107);
    const next = shiftPlannedTimesByDelta(edited, {
      dayIndex: 0,
      deltaMinutes: delta,
      completedPlaceIds: [],
      excludePlaceId: "b",
    });
    assert.equal(next.find((p) => p.id === "a")?.plannedTime, "11:47");
    assert.equal(next.find((p) => p.id === "b")?.plannedTime, "13:47");
    assert.equal(next.find((p) => p.id === "c")?.plannedTime, "15:47");
    assert.equal(next.find((p) => p.id === "h")?.plannedTime, "22:47");
    assert.equal(next.find((p) => p.id === "d1")?.plannedTime, "10:00");
  });

  it("skips completed places and invalid plannedTime", () => {
    const withBad = [
      ...places,
      { id: "x", dayIndex: 0, plannedTime: undefined },
    ];
    const next = shiftPlannedTimesByDelta(withBad, {
      dayIndex: 0,
      deltaMinutes: 30,
      completedPlaceIds: ["a"],
      excludePlaceId: "b",
    });
    assert.equal(next.find((p) => p.id === "a")?.plannedTime, "10:00");
    assert.equal(next.find((p) => p.id === "b")?.plannedTime, "12:00");
    assert.equal(next.find((p) => p.id === "c")?.plannedTime, "14:30");
    assert.equal(next.find((p) => p.id === "x")?.plannedTime, undefined);
  });

  it("addMinutesToHhmm wraps within 24h", () => {
    assert.equal(addMinutesToHhmm("23:30", 60), "00:30");
    assert.equal(addMinutesToHhmm("00:15", -30), "23:45");
  });
});
