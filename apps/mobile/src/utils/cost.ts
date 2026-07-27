import { CITIES } from "../data/destinations";
import type {
  CostSummary,
  Expense,
  ItineraryPlace,
  Trip,
  TripStatus,
} from "../types";

/** 홈·일정 카드용 한국어 상태 라벨 */
export const STATUS_LABEL: Record<TripStatus, string> = {
  planning: "계획중",
  active: "여행중",
  done: "완료",
};

export function sumPlanned(places: ItineraryPlace[]): number {
  return places.reduce((a, p) => a + (Number(p.estimatedCost) || 0), 0);
}

export function sumActual(expenses: Expense[]): number {
  return expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
}

export function currencyForCity(cityId: string): "JPY" | "KRW" {
  const c = CITIES[cityId];
  if (c?.currency === "KRW" || c?.region === "domestic") return "KRW";
  if (c?.currency === "JPY") return "JPY";
  return "KRW";
}

export function formatMoney(
  n: number,
  currency: "JPY" | "KRW" = "KRW",
): string {
  if (currency === "KRW") return `${Math.round(n).toLocaleString("ko-KR")}원`;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

/** 맛집·관광은 1인 단가로 표시/책정 */
export function isPerPersonCategory(category: string | undefined): boolean {
  return category === "food" || category === "attraction";
}

/** 장소 카드용: 맛집·관광은 "1인 N원" */
export function formatPlaceMoney(
  estimatedCost: number,
  category: string | undefined,
  currency: "JPY" | "KRW" = "KRW",
): string {
  const amount = Math.max(0, Number(estimatedCost) || 0);
  if (isPerPersonCategory(category)) {
    if (amount <= 0) return "무료";
    return `1인 ${formatMoney(amount, currency)}`;
  }
  return formatMoney(amount, currency);
}

/** 숙소 1박가 — 알려진 경우만 (0/미상은 null, 가짜 기본가 표시 안 함) */
export function formatHotelNightlyMoney(
  estimatedCost: number | undefined,
  currency: "JPY" | "KRW" = "KRW",
): string | null {
  const amount = Number(estimatedCost);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return formatMoney(amount, currency);
}

/** 숙소 조식 라벨 (포함 여부만 — 식비 금액은 표시하지 않음) */
export function formatHotelBreakfastLabel(
  breakfastIncluded: boolean | undefined,
): string {
  if (breakfastIncluded === true) return "조식 · 포함";
  if (breakfastIncluded === false) return "조식 · 불포함";
  return "조식 · 정보없음";
}

/** 총예산 합산: 맛집·관광은 1인×인원 */
export function placeBudgetAmount(
  place: Pick<ItineraryPlace, "estimatedCost" | "category">,
  partySize: number,
): number {
  const unit = Math.max(0, Number(place.estimatedCost) || 0);
  if (isPerPersonCategory(place.category)) {
    return unit * Math.max(1, Number(partySize) || 1);
  }
  return unit;
}

export function formatYen(n: number): string {
  return formatMoney(n, "JPY");
}

export function buildCostSummary(trip: Trip): CostSummary {
  const byCategory: CostSummary["byCategory"] = {};
  for (const p of trip.places) {
    if (!byCategory[p.category]) byCategory[p.category] = { planned: 0, actual: 0 };
    byCategory[p.category].planned += placeBudgetAmount(p, trip.partySize);
  }
  for (const e of trip.expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = { planned: 0, actual: 0 };
    byCategory[e.category].actual += Number(e.amount) || 0;
  }
  const plannedFromPlaces = trip.places.reduce(
    (s, p) => s + placeBudgetAmount(p, trip.partySize),
    0,
  );
  const plannedTotal =
    trip.plannedBudget > 0 ? trip.plannedBudget : plannedFromPlaces;
  const actualTotal = sumActual(trip.expenses);
  return {
    plannedTotal,
    actualTotal,
    currency: currencyForCity(trip.cityId),
    byCategory,
    variance: actualTotal - plannedTotal,
  };
}

export const CATEGORY_LABEL: Record<string, string> = {
  attraction: "관광",
  food: "맛집",
  hotel: "숙소",
  transport: "교통",
  other: "기타",
  misc: "잡비",
};
