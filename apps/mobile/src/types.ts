/** 로컬 타입 — packages/shared 와 동기 (Expo 번들러가 workspace 패키지를 바로 안 쓸 때 대비) */

import {
  CITIES as DESTINATION_CITIES,
  DEFAULT_CITY_ID,
  getDestinationCity,
  isKnownCityId,
} from "./data/destinations";

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

/** 등록된 도시 id (destinations 카탈로그). 하위 호환을 위해 별칭 유지 */
export type MvpCityId = string;

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
  rating?: number;
  mustVisit?: boolean;
  signatureFood?: string;
  reviewSummary?: string;
  aiReason?: string;
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

/** 출발/도착 세부 지명·주소 */
export type PlaceRef = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  query?: string;
};

/** AI 일정 선호 가중치 (1–5, 높을수록 우선) */
export type TripPreferenceWeights = {
  food: number;
  attraction: number;
  activity: number;
  cost: number;
  minTravel: number;
};

export const DEFAULT_PREFERENCE_WEIGHTS: TripPreferenceWeights = {
  food: 3,
  attraction: 3,
  activity: 3,
  cost: 3,
  minTravel: 3,
};

export type Trip = {
  id: string;
  cityId: MvpCityId;
  cityName: string;
  /** 멀티시티 (선택). 없으면 단일 cityId — 여행지 Day 배정 */
  cities?: TripCityLeg[];
  /** 출발 지점 (세부 지명/주소) */
  origin?: PlaceRef | null;
  /** 도착 지점 (세부 지명/주소) */
  endPoint?: PlaceRef | null;
  /** 경유 도시 (일정 Day 없이 경로에만 표시) */
  stopoverCityIds?: MvpCityId[];
  /** 여행지 도시별 Day 비중 (합 100, cityIds 순서와 대응) */
  cityWeights?: number[];
  preferences?: TripPreferenceWeights;
  mainRequest?: string;
  /** 추가 요청 — AI 프롬프트에서 최우선 */
  extraRequest?: string;
  /** AI 여행 브리핑 */
  briefing?: string;
  /** 경로 한 줄 요약 (출발→여행지→경유→도착) */
  routeOutline?: string;
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
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime?: string;
  userRequest?: string;
  createdAt: string;
  updatedAt: string;
};

export type CostSummary = {
  plannedTotal: number;
  actualTotal: number;
  currency: "JPY" | "KRW";
  byCategory: Record<string, { planned: number; actual: number }>;
  variance: number;
};

export type Screen =
  | "home"
  | "create"
  | "briefing"
  | "plan"
  | "map"
  | "capture"
  | "expenses"
  | "summary"
  | "settings"
  | "tripType";

export const CITIES = DESTINATION_CITIES;
export const MVP_CITY = DESTINATION_CITIES.seoul ?? DESTINATION_CITIES[DEFAULT_CITY_ID];

/** 국내 여행 위자드용 (서울·부산·제주) */
export const DOMESTIC_CITY_IDS: MvpCityId[] = ["seoul", "busan", "jeju"];
export const OVERSEAS_CITY_IDS: MvpCityId[] = ["tokyo", "osaka"];

export function isMvpCityId(id: unknown): id is MvpCityId {
  return typeof id === "string" && isKnownCityId(id);
}

export function isDomesticCityId(id: unknown): boolean {
  return id === "seoul" || id === "busan" || id === "jeju";
}

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
  return getDestinationCity(cityId);
}

/** Day에 해당하는 도시 (멀티시티 지원, 하위 호환) */
export function cityIdForDay(trip: Trip, dayIndex: number): MvpCityId {
  const leg = trip.cities?.find((c) => c.dayIndexes.includes(dayIndex));
  if (leg) return leg.cityId;
  const fromPlace = trip.places.find((p) => p.dayIndex === dayIndex)?.cityId;
  if (fromPlace && isKnownCityId(fromPlace)) return fromPlace;
  return isKnownCityId(trip.cityId) ? trip.cityId : "seoul";
}

/** 도시 표시명 (멀티시티면 합침) */
export function tripCitiesLabel(trip: Trip): string {
  if (trip.cities && trip.cities.length > 1) {
    return trip.cities.map((c) => c.cityName).join(" · ");
  }
  return trip.cityName;
}

/**
 * 특정 Day를 도시에 수동 배정.
 * dayIndexes를 재구성하고, updatePlaces면 해당 Day 장소의 cityId도 갱신.
 */
export function assignDayToCity(
  trip: Trip,
  dayIndex: number,
  cityId: MvpCityId,
  updatePlaces: boolean,
): Trip {
  const meta = getCityMeta(cityId);
  const existing =
    trip.cities && trip.cities.length > 0
      ? trip.cities.map((c) => ({
          ...c,
          dayIndexes: c.dayIndexes.filter((d) => d !== dayIndex),
        }))
      : [
          {
            cityId: trip.cityId,
            cityName: trip.cityName,
            dayIndexes: Array.from({ length: trip.days }, (_, i) => i).filter(
              (d) => d !== dayIndex,
            ),
          },
        ];

  let legs = existing.filter(
    (c) => c.dayIndexes.length > 0 || c.cityId === cityId,
  );
  const target = legs.find((c) => c.cityId === cityId);
  if (target) {
    target.dayIndexes = [...target.dayIndexes, dayIndex].sort((a, b) => a - b);
  } else {
    legs = [
      ...legs,
      {
        cityId,
        cityName: meta.nameKo,
        dayIndexes: [dayIndex],
      },
    ];
  }
  legs = legs.filter((c) => c.dayIndexes.length > 0);

  const places = updatePlaces
    ? trip.places.map((p) =>
        p.dayIndex === dayIndex ? { ...p, cityId } : p,
      )
    : trip.places;

  return {
    ...trip,
    cities: legs,
    cityName:
      legs.length > 1
        ? legs.map((l) => l.cityName).join(" · ")
        : (legs[0]?.cityName ?? trip.cityName),
    places,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * dayIndexes 분할.
 * weights가 있으면 비율대로(합 정규화), 없으면 균등.
 * 각 도시에 최소 1일 보장(일수 >= 도시 수일 때).
 */
export function buildCityLegs(
  cityIds: MvpCityId[],
  days: number,
  weights?: number[],
): TripCityLeg[] {
  const unique = [...new Set(cityIds)].filter((id): id is MvpCityId =>
    isKnownCityId(id),
  );
  if (unique.length === 0) unique.push("seoul");
  if (unique.length === 1) {
    return [
      {
        cityId: unique[0],
        cityName: getCityMeta(unique[0]).nameKo,
        dayIndexes: Array.from({ length: days }, (_, i) => i),
      },
    ];
  }

  const n = unique.length;
  const raw =
    weights && weights.length >= n
      ? unique.map((_, i) => Math.max(0, Number(weights[i]) || 0))
      : unique.map(() => 1);
  const sum = raw.reduce((a, b) => a + b, 0) || n;
  const ratios = raw.map((w) => w / sum);

  let counts = ratios.map((r) => Math.floor(days * r));
  // 최소 1일 (가능하면)
  if (days >= n) {
    for (let i = 0; i < n; i++) {
      if (counts[i] < 1) counts[i] = 1;
    }
  }
  let allocated = counts.reduce((a, b) => a + b, 0);
  // 초과 시 큰 쪽부터 줄임
  while (allocated > days) {
    let maxI = 0;
    for (let i = 1; i < n; i++) {
      if (counts[i] > counts[maxI]) maxI = i;
    }
    if (counts[maxI] <= (days >= n ? 1 : 0)) break;
    counts[maxI] -= 1;
    allocated -= 1;
  }
  // 부족분은 비중 큰 순으로
  const order = ratios
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);
  let rem = days - allocated;
  let oi = 0;
  while (rem > 0 && oi < order.length * 20) {
    counts[order[oi % order.length]] += 1;
    rem -= 1;
    oi += 1;
  }

  const legs: TripCityLeg[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const count = Math.max(0, counts[i]);
    const dayIndexes = Array.from({ length: count }, (_, j) => cursor + j);
    cursor += count;
    legs.push({
      cityId: unique[i],
      cityName: getCityMeta(unique[i]).nameKo,
      dayIndexes,
    });
  }
  // 남은 day가 있으면 마지막에 붙임
  while (cursor < days) {
    const last = legs[legs.length - 1];
    last.dayIndexes.push(cursor);
    cursor += 1;
  }
  return legs;
}

/** 경로 한 줄 요약 */
export function buildRouteOutline(input: {
  origin?: PlaceRef | null;
  endPoint?: PlaceRef | null;
  cityIds: MvpCityId[];
  stopoverCityIds?: MvpCityId[];
}): string {
  const parts: string[] = [];
  if (input.origin?.name) parts.push(input.origin.name);
  const stops = (input.stopoverCityIds ?? []).filter(
    (id) => isKnownCityId(id) && !input.cityIds.includes(id),
  );
  if (input.cityIds.length <= 1) {
    for (const id of input.cityIds) parts.push(getCityMeta(id).nameKo);
    for (const id of stops) parts.push(`(경유 ${getCityMeta(id).nameKo})`);
  } else {
    parts.push(getCityMeta(input.cityIds[0]).nameKo);
    for (const id of stops) parts.push(`(경유 ${getCityMeta(id).nameKo})`);
    for (let i = 1; i < input.cityIds.length; i++) {
      parts.push(getCityMeta(input.cityIds[i]).nameKo);
    }
  }
  if (input.endPoint?.name) parts.push(input.endPoint.name);
  return (
    parts.join(" → ") ||
    getCityMeta(input.cityIds[0] ?? DEFAULT_CITY_ID).nameKo
  );
}
