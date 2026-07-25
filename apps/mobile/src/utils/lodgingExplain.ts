import { CITIES, type ItineraryPlace, type LodgingScoreBreakdown } from "../types";
import { haversineKm } from "./geo";

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

/** API scoreBreakdown이 없을 때 클라이언트 추정 (도시 중심 기준) */
export function estimateLodgingBreakdown(
  place: Pick<
    ItineraryPlace,
    "lat" | "lng" | "estimatedCost" | "rating" | "notes"
  >,
  cityId = "seoul",
  nights = 2,
): { lodgingScore: number; scoreBreakdown: LodgingScoreBreakdown } {
  const city = CITIES[cityId];
  const center = city?.center ?? { lat: 37.5665, lng: 126.978 };
  const domestic = city?.countryId === "kr" || city?.region === "domestic";

  const km = haversineKm(
    { lat: Number(place.lat), lng: Number(place.lng) },
    center,
  );
  const centrality = Math.round(
    Math.max(35, Math.min(98, (1 - Math.min(km, 8) / 8) * 100)),
  );

  const defaultPerNight = domestic ? 120000 : 18000;
  const perNight =
    nights > 0
      ? Math.max(1, Number(place.estimatedCost) || defaultPerNight) / nights
      : Number(place.estimatedCost) || defaultPerNight;
  const priceLo = domestic ? 80000 : 8000;
  const priceHi = domestic ? 180000 : 35000;
  const priceSpan = priceHi - priceLo;
  const priceEstimate = Math.round(
    Math.max(
      20,
      Math.min(
        95,
        95 -
          ((Math.min(Math.max(perNight, priceLo), priceHi) - priceLo) /
            priceSpan) *
            75,
      ),
    ),
  );

  const realRating = Number(place.rating);
  let ratingProxy: number;
  if (Number.isFinite(realRating) && realRating > 0) {
    ratingProxy = Math.round(
      40 + (Math.min(5, Math.max(1, realRating)) - 1) * 14.5,
    );
  } else {
    const notes = String(place.notes || "").toLowerCase();
    ratingProxy = 70 + Math.round((centrality - 50) * 0.25);
    if (/추천|허브|역앞|편리/.test(notes)) ratingProxy += 8;
    if (/조용|저렴/.test(notes)) ratingProxy += 3;
  }
  ratingProxy = Math.max(40, Math.min(98, ratingProxy));

  const lodgingScore = Math.max(
    1,
    Math.min(
      100,
      Math.round(centrality * 0.5 + priceEstimate * 0.25 + ratingProxy * 0.25),
    ),
  );

  return {
    lodgingScore,
    scoreBreakdown: { centrality, priceEstimate, ratingProxy },
  };
}

/** scoreBreakdown 기반 짧은 tip (주소 대신) */
export function lodgingTipFromBreakdown(
  bd: LodgingScoreBreakdown | undefined | null,
  rating?: number,
  cityNameKo = "",
): string {
  const parts: string[] = [];
  const c = Number(bd?.centrality);
  if (c >= 75) parts.push("시내·교통 접근 좋음");
  else if (c >= 55) parts.push("동선 이동 무난");
  else if (Number.isFinite(c)) parts.push("한적한 위치");

  const pe = Number(bd?.priceEstimate);
  if (pe >= 75) parts.push("가격 부담 적음");
  else if (pe < 55 && Number.isFinite(pe)) parts.push("프리미엄 가격대");

  if (Number.isFinite(Number(rating)) && Number(rating) >= 4.3) {
    parts.push("평점 우수");
  } else if (Number.isFinite(Number(rating)) && Number(rating) >= 3.8) {
    parts.push("평점 무난");
  }

  if (parts.length) return parts.join(" · ");
  return cityNameKo ? `${cityNameKo} 숙소 추천` : "동선·가격·평점 종합 추천";
}
