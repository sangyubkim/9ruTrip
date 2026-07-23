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

export function buildCostSummary(trip: Trip): CostSummary {
  const byCategory: CostSummary["byCategory"] = {};
  for (const p of trip.places) {
    if (!byCategory[p.category]) byCategory[p.category] = { planned: 0, actual: 0 };
    byCategory[p.category].planned += Number(p.estimatedCost) || 0;
  }
  for (const e of trip.expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = { planned: 0, actual: 0 };
    byCategory[e.category].actual += Number(e.amount) || 0;
  }
  const plannedTotal =
    trip.plannedBudget > 0 ? trip.plannedBudget : sumPlanned(trip.places);
  const actualTotal = sumActual(trip.expenses);
  return {
    plannedTotal,
    actualTotal,
    currency: "JPY",
    byCategory,
    variance: actualTotal - plannedTotal,
  };
}

export function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  attraction: "관광",
  food: "음식",
  hotel: "숙소",
  transport: "교통",
  other: "기타",
  misc: "잡비",
};
