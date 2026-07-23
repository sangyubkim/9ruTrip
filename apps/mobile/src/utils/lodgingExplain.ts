import type { LodgingScoreBreakdown } from "../types";

function band(score: number): "높음" | "보통" | "낮음" {
  if (score >= 75) return "높음";
  if (score >= 55) return "보통";
  return "낮음";
}

/**
 * scoreBreakdown → 한국어 한 줄 설명 (카드용).
 */
export function formatLodgingScoreLines(
  bd: LodgingScoreBreakdown | undefined | null,
): string[] {
  if (!bd) return [];
  return [
    `역세권 근접 ${band(Number(bd.centrality) || 0)} (${Math.round(Number(bd.centrality) || 0)})`,
    `가격 경쟁력 ${band(Number(bd.priceEstimate) || 0)} (${Math.round(Number(bd.priceEstimate) || 0)})`,
    `평점 ${band(Number(bd.ratingProxy) || 0)} (${Math.round(Number(bd.ratingProxy) || 0)})`,
  ];
}

export function formatLodgingScoreBrief(
  bd: LodgingScoreBreakdown | undefined | null,
): string {
  return formatLodgingScoreLines(bd).join(" · ");
}
