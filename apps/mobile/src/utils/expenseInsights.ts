import type { CostSummary, Trip } from "../types";
import { buildCostSummary, CATEGORY_LABEL, formatYen } from "./cost";

/**
 * After(요약)용 한국어 인사이트 1–3줄.
 */
export function buildExpenseInsights(
  trip: Trip,
  summary?: CostSummary,
): string[] {
  const s = summary ?? buildCostSummary(trip);
  const lines: string[] = [];
  const planned = s.plannedTotal || 0;
  const actual = s.actualTotal || 0;

  if (actual <= 0 && planned <= 0) {
    return ["경비·계획이 아직 없어 인사이트를 만들 수 없습니다."];
  }

  if (actual > 0 && planned > 0) {
    const pct = Math.round((actual / planned) * 100);
    if (pct > 110) {
      lines.push(
        `실제 지출이 계획(${formatYen(planned)})의 약 ${pct}%입니다. 남은 일정에서 교통·식비를 조절해 보세요.`,
      );
    } else if (pct < 85) {
      lines.push(
        `실제 지출이 계획 대비 약 ${pct}%로 여유 있습니다. 남는 예산으로 한 끼·체험을 더해도 됩니다.`,
      );
    } else {
      lines.push(
        `실제 지출이 계획과 비슷합니다(${pct}%). 현재 페이스를 유지하면 예산 내에서 마감하기 쉽습니다.`,
      );
    }
  } else if (actual > 0) {
    lines.push(`실제 지출 ${formatYen(actual)}이 기록되었습니다.`);
  } else {
    lines.push(`계획 예산 ${formatYen(planned)} 기준입니다. 경비를 기록하면 비교 인사이트가 생깁니다.`);
  }

  const food = s.byCategory.food?.actual ?? 0;
  const transport = s.byCategory.transport?.actual ?? 0;
  if (actual > 0) {
    if (food / actual >= 0.35) {
      lines.push(
        `식비 비중이 높습니다(${formatYen(food)}, 약 ${Math.round((food / actual) * 100)}%). 편의점·세트메뉴로 한 끼를 줄이면 여유가 납니다.`,
      );
    }
    if (transport / actual >= 0.25) {
      lines.push(
        `교통(택시 포함) 비중이 큽니다(${formatYen(transport)}). 구간은 대중교통·도보를 우선하면 절약에 유리합니다.`,
      );
    }
  }

  // 택시 추정: transport + label/SMS에 택시
  const taxiLike = trip.expenses.filter(
    (e) =>
      e.category === "transport" &&
      /택시|taxi|uber|grab/i.test(`${e.label ?? ""} ${e.sourceSms ?? ""}`),
  );
  const taxiSum = taxiLike.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  if (taxiSum > 0 && actual > 0 && taxiSum / actual >= 0.12) {
    lines.push(
      `택시성 지출 ${formatYen(taxiSum)}이 눈에 띕니다. 짧은 구간은 지하철·버스로 바꿔 보세요.`,
    );
  }

  // 카테고리 top
  if (lines.length < 3 && actual > 0) {
    const ranked = Object.entries(s.byCategory)
      .map(([k, v]) => ({ k, actual: v.actual }))
      .filter((x) => x.actual > 0)
      .sort((a, b) => b.actual - a.actual);
    if (ranked[0]) {
      const label = CATEGORY_LABEL[ranked[0].k] || ranked[0].k;
      lines.push(
        `가장 큰 실제 지출 카테고리는 ${label}(${formatYen(ranked[0].actual)})입니다.`,
      );
    }
  }

  return lines.slice(0, 3);
}
