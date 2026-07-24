import { apiFetch } from "./client";
import type {
  ItineraryPlace,
  LodgingCandidate,
  MvpCityId,
  PlaceCategory,
  PlaceRef,
  TransportOption,
  Trip,
  TripPreferenceWeights,
} from "../types";

export type ItineraryRequest = {
  cityId: MvpCityId;
  /** 멀티시티 여행지: 예 ["tokyo","osaka"] */
  cityIds?: MvpCityId[];
  nights: number;
  days: number;
  partySize: number;
  origin?: PlaceRef | null;
  endPoint?: PlaceRef | null;
  stopoverCityIds?: MvpCityId[];
  /** 여행지별 Day 비중 (합 ~100) */
  cityWeights?: number[];
  preferences?: TripPreferenceWeights;
  mainRequest?: string;
  extraRequest?: string;
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime?: string;
  userRequest?: string;
};

export type ItineraryResponse = {
  places: ItineraryPlace[];
  plannedBudget: number;
  summary: string;
  engine: string;
  lodgingCandidates?: LodgingCandidate[];
  preferredLodgingId?: string | null;
  cityId?: MvpCityId;
  cities?: { cityId: MvpCityId; cityName: string; dayIndexes: number[] }[];
  mapProvider?: "google" | "naver";
  transportEngine?: string;
  briefing?: string;
  routeOutline?: string;
};

export async function generateItinerary(
  payload: ItineraryRequest,
): Promise<ItineraryResponse> {
  const res = await apiFetch("/trip/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ItineraryResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Itinerary failed: ${res.status}`);
  }
  return json;
}

export type RerouteRequest = {
  trip: Trip;
  dayIndex: number;
  reason?: string;
  completedPlaceIds?: string[];
};

export type RerouteResponse = {
  places: ItineraryPlace[];
  plannedBudget: number;
  summary: string;
  engine: string;
  dayIndex: number;
  replacedCount: number;
};

export async function rerouteTrip(payload: RerouteRequest): Promise<RerouteResponse> {
  const res = await apiFetch("/trip/reroute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RerouteResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Reroute failed: ${res.status}`);
  }
  return json;
}

export type ExportDraftResponse = {
  draft: {
    id: string;
    title: string;
    steps: { id: string; imageUri: string | null; caption: string; order: number }[];
    body: string;
    excerpt: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  next: { docsApi: string; note: string };
};

export async function exportTripDraft(trip: unknown): Promise<ExportDraftResponse> {
  const res = await apiFetch("/trip/export-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trip }),
  });
  const json = (await res.json()) as ExportDraftResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Export failed: ${res.status}`);
  }
  return json;
}

export type PublishRequest = {
  trip?: Trip;
  title?: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "publish";
  tags?: string[];
};

export type PublishResponse = {
  postId: number;
  link: string;
  editLink: string | null;
  featuredMediaId: number | null;
  tagIds: number[];
  seoApplied: boolean;
};

export async function publishTripToWordPress(
  payload: PublishRequest,
): Promise<PublishResponse> {
  const res = await apiFetch("/wordpress/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as PublishResponse & {
    error?: string;
    hint?: string;
  };
  if (!res.ok) {
    throw new Error(
      [json.error, json.hint].filter(Boolean).join("\n") ||
        `Publish failed: ${res.status}`,
    );
  }
  return json;
}

export type ParseSmsResponse = {
  ok: boolean;
  amountKrw?: number;
  amountJpyEstimate?: number;
  merchant?: string;
  currencyHint?: string;
  error?: string;
  raw?: string;
};

export async function parseSmsExpense(text: string): Promise<ParseSmsResponse> {
  const res = await apiFetch("/trip/parse-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return (await res.json()) as ParseSmsResponse;
}

export async function enrichTransport(
  places: ItineraryPlace[],
  forceRecalc = true,
  cityId?: MvpCityId,
): Promise<{ places: ItineraryPlace[]; transportEngine?: string }> {
  const res = await apiFetch("/trip/enrich-transport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ places, forceRecalc, cityId }),
  });
  const json = (await res.json()) as {
    places: ItineraryPlace[];
    transportEngine?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Enrich failed: ${res.status}`);
  }
  return json;
}

export type CompareTransportResponse = {
  options: TransportOption[];
  engine: string;
  from?: { lat: number; lng: number; name?: string };
  to?: { lat: number; lng: number; name?: string };
  googleMapsConfigured?: boolean;
};

/** 구간 이동 수단 비교 (도보/대중교통/택시) */
export async function compareTransport(payload: {
  from?: { lat: number; lng: number; name?: string };
  to?: { lat: number; lng: number; name?: string };
  places?: ItineraryPlace[];
  placeId?: string;
}): Promise<CompareTransportResponse> {
  const res = await apiFetch("/trip/compare-transport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as CompareTransportResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Compare failed: ${res.status}`);
  }
  return json;
}

export async function suggestPlaces(payload: {
  cityId: MvpCityId;
  category?: PlaceCategory;
  partySize?: number;
}): Promise<{
  places: ItineraryPlace[];
  source?: string;
  googleMapsConfigured?: boolean;
}> {
  const res = await apiFetch("/trip/suggest-places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    places: ItineraryPlace[];
    source?: string;
    googleMapsConfigured?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Suggest failed: ${res.status}`);
  }
  return json;
}

export type PlaceSearchResult = {
  placeId?: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  cityId?: string;
};

export async function searchPlaces(payload: {
  query: string;
  cityId?: string;
}): Promise<{ results: PlaceSearchResult[]; source?: string }> {
  const res = await apiFetch("/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    results?: PlaceSearchResult[];
    source?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `Place search failed: ${res.status}`);
  }
  return { results: json.results ?? [], source: json.source };
}

export type OptimizeDayResponse = {
  places: ItineraryPlace[];
  dayIndex: number;
  before: string[];
  after: string[];
  engine: string;
  summary: string;
  pathKmBefore?: number;
  pathKmAfter?: number;
};

/** 당일 동선 최적화 (Gemini 또는 nearest-neighbor 폴백) */
export async function optimizeDay(payload: {
  places: ItineraryPlace[];
  dayIndex: number;
  cityId?: MvpCityId;
}): Promise<OptimizeDayResponse> {
  const res = await apiFetch("/trip/optimize-day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as OptimizeDayResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Optimize failed: ${res.status}`);
  }
  return json;
}

export async function checkHealth(): Promise<{
  ok: boolean;
  geminiConfigured?: boolean;
  wordpressConfigured?: boolean;
  googleMapsConfigured?: boolean;
}> {
  const res = await apiFetch("/health");
  let data: {
    ok?: boolean;
    geminiConfigured?: boolean;
    wordpressConfigured?: boolean;
    googleMapsConfigured?: boolean;
    service?: string;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(
      "9ruTrip API 응답을 해석할 수 없습니다. URL이 …/apps/api (또는 LAN :3011) 인지 확인하세요.",
    );
  }
  if (!res.ok || !data?.ok) {
    throw new Error(
      "헬스체크 실패. 9ruDocs API 주소가 아닌지, 경로가 /apps/api 인지 확인하세요.",
    );
  }
  if (data.service && data.service !== "9rutrip-api") {
    throw new Error(
      `다른 서비스 응답(${data.service}). 9ruTrip Cloudways 앱 URL을 사용하세요 (Docs URL 불가).`,
    );
  }
  return {
    ok: true,
    geminiConfigured: data.geminiConfigured,
    wordpressConfigured: data.wordpressConfigured,
    googleMapsConfigured: data.googleMapsConfigured,
  };
}
