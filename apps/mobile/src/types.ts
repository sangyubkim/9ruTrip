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
  plannedTime?: string;
  travelFromPrevMinutes?: number;
  travelFromPrevCost?: number;
  lodgingScore?: number;
  scoreBreakdown?: LodgingScoreBreakdown;
  transportEngine?: string;
  preferredTransportMode?: TransportMode;
  transportOptions?: TransportOption[];
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

export type MvpCityId = "tokyo" | "osaka";

export type MapProviderId = "google" | "naver";

export type Trip = {
  id: string;
  cityId: MvpCityId;
  cityName: string;
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

export function getCityMeta(cityId: MvpCityId) {
  return CITIES[cityId] ?? CITIES.tokyo;
}
