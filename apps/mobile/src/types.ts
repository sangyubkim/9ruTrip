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

export type MvpCityId = "tokyo";

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

export const MVP_CITY = {
  id: "tokyo" as const,
  nameKo: "도쿄",
  nameEn: "Tokyo",
  center: { lat: 35.681236, lng: 139.767125 },
};
