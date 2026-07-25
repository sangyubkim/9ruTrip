import type {
  CostSummary,
  Expense,
  ItineraryPlace,
  PlaceReview,
  TravelDiaryEntry,
  Trip,
} from "./types.js";
import type { BlogDraft, Step } from "./types.js";

export function sumPlannedCost(places: ItineraryPlace[]): number {
  return places.reduce((acc, p) => acc + (Number(p.estimatedCost) || 0), 0);
}

export function sumActualCost(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
}

export function buildCostSummary(trip: Trip): CostSummary {
  const byCategory: CostSummary["byCategory"] = {};

  for (const p of trip.places) {
    const key = p.category;
    if (!byCategory[key]) byCategory[key] = { planned: 0, actual: 0 };
    byCategory[key].planned += Number(p.estimatedCost) || 0;
  }

  for (const e of trip.expenses) {
    const key = e.category;
    if (!byCategory[key]) byCategory[key] = { planned: 0, actual: 0 };
    byCategory[key].actual += Number(e.amount) || 0;
  }

  const plannedTotal =
    trip.plannedBudget > 0 ? trip.plannedBudget : sumPlannedCost(trip.places);
  const actualTotal = sumActualCost(trip.expenses);

  return {
    plannedTotal,
    actualTotal,
    currency:
      trip.cityId === "tokyo" || trip.cityId === "osaka" ? "JPY" : "KRW",
    byCategory,
    variance: actualTotal - plannedTotal,
  };
}

/** 여행 리뷰 → 9ruDocs BlogDraft 형태로 변환 (발행 훅) */
export function tripReviewsToBlogDraft(trip: Trip): BlogDraft {
  const now = new Date().toISOString();
  const sorted = [...trip.reviews].sort((a, b) => a.order - b.order);
  const steps: Step[] = sorted.map((r, i) => ({
    id: r.id,
    imageUri: r.imageUri,
    caption: r.placeName
      ? `[${r.placeName}] ${r.caption}${r.rating ? ` ★${r.rating}` : ""}`
      : r.caption,
    order: i,
  }));

  const bodyParts = steps.map(
    (s, i) => `## ${i + 1}. ${s.caption || "기록"}\n\n(사진 첨부)\n`,
  );

  return {
    id: `export-${trip.id}`,
    title: `${trip.cityName} ${trip.nights}박 ${trip.days}일 여행 후기`,
    steps,
    body: bodyParts.join("\n"),
    excerpt: `${trip.cityName} 여행 기록 · ${trip.partySize}명`,
    tags: [trip.cityName, "여행", "9ruTrip", trip.cityId],
    createdAt: now,
    updatedAt: now,
  };
}

/** 완료 여행을 외부 서비스에도 전달 가능한 평면 JSON 다이어리 엔트리로 변환한다. */
export function tripToDiaryEntry(trip: Trip): TravelDiaryEntry {
  const cityIds = trip.cities?.map((city) => city.cityId) ?? [trip.cityId];
  const cityNames = trip.cities?.map((city) => city.cityName) ?? [trip.cityName];
  const currency =
    trip.cityId === "tokyo" || trip.cityId === "osaka" ? "JPY" : "KRW";
  const completedAt = trip.updatedAt || new Date().toISOString();

  return {
    id: `diary-${trip.id}`,
    tripId: trip.id,
    title: cityNames.join(" · "),
    cityIds,
    cityNames,
    nights: trip.nights,
    days: trip.days,
    ...(trip.startDate ? { startDate: trip.startDate } : {}),
    ...(trip.endDate ? { endDate: trip.endDate } : {}),
    completedAt,
    partySize: trip.partySize,
    ...(trip.plannedBudget > 0
      ? { plannedBudget: trip.plannedBudget, currency }
      : {}),
    coverPlaceName: trip.places[0]?.name,
    placeCount: trip.places.length,
    updatedAt: completedAt,
    syncStatus: "local",
  };
}

export function reviewsToSteps(reviews: PlaceReview[]): Step[] {
  return [...reviews]
    .sort((a, b) => a.order - b.order)
    .map((r, i) => ({
      id: r.id,
      imageUri: r.imageUri,
      caption: r.caption,
      order: i,
    }));
}

export * from "./types.js";
export * from "./schemas.js";
export * from "./cities.js";
export * from "./maps.js";
export * from "./docs-compat.js";
export * from "./tripHelpers.js";
