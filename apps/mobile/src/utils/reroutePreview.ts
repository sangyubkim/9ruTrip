import type { ItineraryPlace } from "../types";

export type RerouteChangeSummary = {
  dayLabel: string;
  removed: string[];
  added: string[];
  renamed: { from: string; to: string }[];
  unchangedCount: number;
  text: string;
};

/**
 * 재루트 적용 전 미리보기용: 당일 미완료 장소 이름 변화 요약
 */
export function summarizeRerouteChanges(
  before: ItineraryPlace[],
  after: ItineraryPlace[],
  dayIndex: number,
  completedPlaceIds: string[] = [],
): RerouteChangeSummary {
  const done = new Set(completedPlaceIds);
  const oldDay = before
    .filter((p) => p.dayIndex === dayIndex && !done.has(p.id))
    .sort((a, b) => a.order - b.order);
  const newDay = after
    .filter((p) => p.dayIndex === dayIndex && !done.has(p.id))
    .sort((a, b) => a.order - b.order);

  const oldNames = oldDay.map((p) => p.name);
  const newNames = newDay.map((p) => p.name);
  const oldSet = new Set(oldNames);
  const newSet = new Set(newNames);

  const removed = oldNames.filter((n) => !newSet.has(n));
  const added = newNames.filter((n) => !oldSet.has(n));

  // 순서상 같은 인덱스의 이름 변경 (대략적)
  const renamed: { from: string; to: string }[] = [];
  const len = Math.min(oldNames.length, newNames.length);
  for (let i = 0; i < len; i++) {
    if (
      oldNames[i] !== newNames[i] &&
      !newSet.has(oldNames[i]) &&
      !oldSet.has(newNames[i])
    ) {
      renamed.push({ from: oldNames[i], to: newNames[i] });
    }
  }

  const unchangedCount = newNames.filter((n) => oldSet.has(n)).length;
  const lines: string[] = [`Day ${dayIndex + 1} 변경 요약`];
  if (removed.length) {
    lines.push(`제거: ${removed.slice(0, 6).join(", ")}${removed.length > 6 ? "…" : ""}`);
  }
  if (added.length) {
    lines.push(`추가: ${added.slice(0, 6).join(", ")}${added.length > 6 ? "…" : ""}`);
  }
  if (renamed.length && !removed.length && !added.length) {
    lines.push(
      ...renamed
        .slice(0, 5)
        .map((r) => `${r.from} → ${r.to}`),
    );
  }
  if (!removed.length && !added.length && !renamed.length) {
    lines.push("장소 구성은 비슷하고 순서·시각만 조정될 수 있습니다.");
  }
  lines.push(`유지 ${unchangedCount}곳 · 새 일정 ${newNames.length}곳`);

  return {
    dayLabel: `Day ${dayIndex + 1}`,
    removed,
    added,
    renamed,
    unchangedCount,
    text: lines.join("\n"),
  };
}
