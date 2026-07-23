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

/** 구간 이동 수단 비교 (도보 / 대중교통 / 택시) */
export type TransportMode = "walking" | "transit" | "taxi";

export type TransportOption = {
  mode: TransportMode;
  /** 예상 이동 분 */
  minutes: number;
  /** 예상 비용(엔) */
  estimatedCost: number;
  /** haversine:walking | directions:transit | directions:driving 등 */
  engine: string;
};

export type LodgingScoreBreakdown = {
  /** 교통 허브 근접 (1–100) */
  centrality: number;
  /** 가격 경쟁력 추정 (1–100, 저렴할수록 높음) */
  priceEstimate: number;
  /** 평점 프록시 (1–100) */
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

/** 해외 MVP: tokyo (기본) + osaka (선택). 국내는 추후 naver */
export type MvpCityId = "tokyo" | "osaka";

export type MapProviderId = "google" | "naver";

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
  /** 멀티시티: 장소가 속한 도시 (없으면 Trip.cityId) */
  cityId?: MvpCityId;
  /** 예정 시각 HH:mm (가이드 알람용) */
  plannedTime?: string;
  /** 직전 장소 → 현재 이동 분 */
  travelFromPrevMinutes?: number;
  /** 직전 장소 → 현재 이동 비용(엔) */
  travelFromPrevCost?: number;
  /** 숙소 추천 점수 1–100 */
  lodgingScore?: number;
  scoreBreakdown?: LodgingScoreBreakdown;
  /** haversine | directions:transit | directions:walking | directions:driving */
  transportEngine?: string;
  /** 사용자가 고른 구간 이동 수단 */
  preferredTransportMode?: TransportMode;
  /** 도보/대중교통/택시 비교 옵션 */
  transportOptions?: TransportOption[];
};

/** 멀티시티 여행의 도시별 Day 할당 */
export type TripCityLeg = {
  cityId: MvpCityId;
  cityName: string;
  dayIndexes: number[];
};

/** 체크인·준비 체크리스트 항목 */
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
  /** SMS 파싱 원문 (선택) */
  sourceSms?: string;
};

/** Step + 장소 메타 (여행 중 리뷰 캡처) */
export type PlaceReview = Step & {
  placeId?: string;
  placeName?: string;
  rating?: number;
};

export type TripStatus = "planning" | "active" | "done";

export type Trip = {
  id: string;
  /** 주 도시 (하위 호환 · cities[0]과 동기) */
  cityId: MvpCityId;
  cityName: string;
  /**
   * 멀티시티 (선택). 없으면 단일 cityId만 사용.
   * 예: 도쿄 Day0–1 + 오사카 Day2–3
   */
  cities?: TripCityLeg[];
  nights: number;
  days: number;
  partySize: number;
  places: ItineraryPlace[];
  expenses: Expense[];
  reviews: PlaceReview[];
  /** 숙소 후보 Top N */
  lodgingCandidates?: LodgingCandidate[];
  /** 사용자가 고른 숙소 후보 id */
  preferredLodgingId?: string | null;
  /** 지도 프로바이더 (도시 메타에서 파생) */
  mapProvider?: MapProviderId;
  /** 계획 총예산 (엔) — places estimatedCost 합 또는 수동 */
  plannedBudget: number;
  status: TripStatus;
  /** AI 재루트 어시스트 ON/OFF */
  aiRerouteEnabled: boolean;
  /** 일정 기반 가이드 알람 */
  guideAlarmsEnabled: boolean;
  /** 방문 완료로 표시한 장소 id */
  completedPlaceIds: string[];
  /** 체크인 체크리스트 (예약번호·여권 등) */
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
