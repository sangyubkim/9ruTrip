/** 9ruDocs Step 호환 — WordPress 발행 파이프라인으로 넘길 때 그대로 사용 */
export type Step = {
  id: string;
  imageUri: string | null;
  caption: string;
  order: number;
};

/** 9ruDocs BlogDraft 호환 */
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
  /** 계획 비용 (엔, MVP 도쿄) */
  estimatedCost: number;
  notes?: string;
  dayIndex: number;
  order: number;
};

export type Expense = {
  id: string;
  label: string;
  amount: number;
  currency: "JPY" | "KRW" | "USD";
  category: PlaceCategory | "misc";
  placeId?: string;
  createdAt: string;
};

/** Step + 장소 메타 (여행 중 리뷰 캡처) */
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
  /** 계획 총예산 (엔) — places estimatedCost 합 또는 수동 */
  plannedBudget: number;
  status: TripStatus;
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
