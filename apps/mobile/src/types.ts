/** 로컬 타입 — packages/shared 와 동기 (Expo 번들러가 workspace 패키지를 바로 안 쓸 때 대비) */

export type Step = {
  id: string;
  imageUri: string | null;
  caption: string;
  order: number;
};

export type BlogDraft = {
  id: string;
  title: string;
  steps: Step[];
  body: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlaceCategory =
  | "attraction"
  | "food"
  | "hotel"
  | "transport"
  | "other";

export type TransportMode = "walking" | "transit" | "taxi";

export type TransportOption = {
  mode: TransportMode;
  minutes: number;
  estimatedCost: number;
  engine: string;
  deepLink?: string;
  deepLinks?: {
    google?: string;
    yahoo?: string;
  };
  note?: string;
};

export type LodgingScoreBreakdown = {
  centrality: number;
  priceEstimate: number;
  ratingProxy: number;
};

export type LodgingCandidate = {
  id: string;
  name: string;
  category: "hotel";
  lat: number;
  lng: number;
  estimatedCost: number;
  notes?: string;
  lodgingScore: number;
  scoreBreakdown: LodgingScoreBreakdown;
};

export type MvpCityId = "tokyo" | "osaka";

export type MapProviderId = "google" | "naver";

export type ItineraryPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  estimatedCost: number;
  notes?: string;
  dayIndex: number;
  order: number;
  /** 멀티시티: 장소가 속한 도시 (없으면 Trip.cityId) */
  cityId?: MvpCityId;
  plannedTime?: string;
  travelFromPrevMinutes?: number;
  travelFromPrevCost?: number;
  lodgingScore?: number;
  scoreBreakdown?: LodgingScoreBreakdown;
  transportEngine?: string;
  preferredTransportMode?: TransportMode;
  transportOptions?: TransportOption[];
};

export type TripCityLeg = {
  cityId: MvpCityId;
  cityName: string;
  dayIndexes: number[];
};

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type Expense = {
  id: string;
  label: string;
  amount: number;
  currency: "JPY" | "KRW" | "USD";
  category: PlaceCategory | "misc";
  placeId?: string;
  createdAt: string;
  sourceSms?: string;
};

export type PlaceReview = Step & {
  placeId?: string;
  placeName?: string;
  rating?: number;
};

export type TripStatus = "planning" | "active" | "done";

export type Trip = {
  id: string;
  cityId: MvpCityId;
  cityName: string;
  /** 멀티시티 (선택). 없으면 단일 cityId */
  cities?: TripCityLeg[];
  nights: number;
  days: number;
  partySize: number;
  places: ItineraryPlace[];
  expenses: Expense[];
  reviews: PlaceReview[];
  lodgingCandidates?: LodgingCandidate[];
  preferredLodgingId?: string | null;
  mapProvider?: MapProviderId;
  plannedBudget: number;
  status: TripStatus;
  aiRerouteEnabled: boolean;
  guideAlarmsEnabled: boolean;
  completedPlaceIds: string[];
  checklist?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
};

export type CostSummary = {
  plannedTotal: number;
  actualTotal: number;
  currency: "JPY";
  byCategory: Record<string, { planned: number; actual: number }>;
  variance: number;
};

export type Screen =
  | "home"
  | "create"
  | "plan"
  | "map"
  | "capture"
  | "expenses"
  | "summary"
  | "settings";

export const CITIES = {
  tokyo: {
    id: "tokyo" as const,
    nameKo: "도쿄",
    nameEn: "Tokyo",
    center: { lat: 35.681236, lng: 139.767125 },
    mapProvider: "google" as const,
  },
  osaka: {
    id: "osaka" as const,
    nameKo: "오사카",
    nameEn: "Osaka",
    center: { lat: 34.6937, lng: 135.5023 },
    mapProvider: "google" as const,
  },
};

export const MVP_CITY = CITIES.tokyo;

export const DEFAULT_CHECKLIST_LABELS = [
  "예약번호",
  "여권",
  "WiFi",
  "미팅포인트",
] as const;

export function createDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_LABELS.map((label, i) => ({
    id: `check-${i}-${label}`,
    label,
    checked: false,
  }));
}

export function getCityMeta(cityId: MvpCityId) {
  return CITIES[cityId] ?? CITIES.tokyo;
}

/** Day에 해당하는 도시 (멀티시티 지원, 하위 호환) */
export function cityIdForDay(trip: Trip, dayIndex: number): MvpCityId {
  const leg = trip.cities?.find((c) => c.dayIndexes.includes(dayIndex));
  if (leg) return leg.cityId;
  const fromPlace = trip.places.find((p) => p.dayIndex === dayIndex)?.cityId;
  if (fromPlace === "osaka" || fromPlace === "tokyo") return fromPlace;
  return trip.cityId === "osaka" ? "osaka" : "tokyo";
}

/** 도시 표시명 (멀티시티면 합침) */
export function tripCitiesLabel(trip: Trip): string {
  if (trip.cities && trip.cities.length > 1) {
    return trip.cities.map((c) => c.cityName).join(" · ");
  }
  return trip.cityName;
}

/** dayIndexes 균등 분할로 TripCityLeg[] 생성 */
export function buildCityLegs(
  cityIds: MvpCityId[],
  days: number,
): TripCityLeg[] {
  const unique = [...new Set(cityIds)].filter(
    (id): id is MvpCityId => id === "tokyo" || id === "osaka",
  );
  if (unique.length === 0) unique.push("tokyo");
  if (unique.length === 1) {
    return [
      {
        cityId: unique[0],
        cityName: getCityMeta(unique[0]).nameKo,
        dayIndexes: Array.from({ length: days }, (_, i) => i),
      },
    ];
  }
  const split = Math.max(1, Math.ceil(days / unique.length));
  const legs: TripCityLeg[] = [];
  let cursor = 0;
  for (let i = 0; i < unique.length; i++) {
    const id = unique[i];
    const isLast = i === unique.length - 1;
    const count = isLast ? days - cursor : Math.min(split, days - cursor);
    const dayIndexes = Array.from({ length: Math.max(0, count) }, (_, j) => cursor + j);
    cursor += count;
    legs.push({
      cityId: id,
      cityName: getCityMeta(id).nameKo,
      dayIndexes,
    });
  }
  return legs;
}
