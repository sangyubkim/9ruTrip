import { apiFetch, readApiJson } from "./client";
import type {
  ItineraryPlace,
  LodgingCandidate,
  MvpCityId,
  PlaceCategory,
  OutboundTransportMode,
  PlaceRef,
  TransportOption,
  TravelDiaryEntry,
  Trip,
  TripPreferenceWeights,
} from "../types";

export type ItineraryRequest = {
  cityId: MvpCityId;
  /** 멀티시티 여행지: 예 ["tokyo","osaka"] */
  cityIds?: MvpCityId[];
  nights: number;
  days: number;
  /** 여행 출발일 YYYY-MM-DD */
  startDate?: string;
  /** 여행 복귀일 YYYY-MM-DD */
  endDate?: string;
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
  /** 출발지 → 첫 여행지 이동수단 */
  outboundTransportMode?: OutboundTransportMode;
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
  const json = await readApiJson<ItineraryResponse & { error?: string }>(res);
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
  /** reflect: 사용자 일정 반영 요청으로 Day 재구성 */
  mode?: "reroute" | "reflect";
  lodgingReturnTime?: string;
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
  const json = await readApiJson<RerouteResponse & { error?: string }>(res);
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
  const json = await readApiJson<ExportDraftResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error ?? `Export failed: ${res.status}`);
  }
  return json;
}

export async function fetchDiaryEntries(year?: string): Promise<TravelDiaryEntry[]> {
  const suffix = year ? `?year=${encodeURIComponent(year)}` : "";
  const res = await apiFetch(`/diary${suffix}`);
  const json = await readApiJson<{ entries?: TravelDiaryEntry[]; error?: string }>(res);
  if (!res.ok) throw new Error(json.error ?? `Diary fetch failed: ${res.status}`);
  return json.entries ?? [];
}

export async function upsertDiaryFromTrip(trip: Trip): Promise<TravelDiaryEntry> {
  const res = await apiFetch("/diary/from-trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trip }),
  });
  const json = await readApiJson<{ entry?: TravelDiaryEntry; error?: string }>(res);
  if (!res.ok || !json.entry) {
    throw new Error(json.error ?? `Diary sync failed: ${res.status}`);
  }
  return json.entry;
}

export async function updateDiaryEntry(
  id: string,
  patch: Pick<TravelDiaryEntry, "notes">,
): Promise<TravelDiaryEntry> {
  const res = await apiFetch(`/diary/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await readApiJson<{ entry?: TravelDiaryEntry; error?: string }>(res);
  if (!res.ok || !json.entry) {
    throw new Error(json.error ?? `Diary update failed: ${res.status}`);
  }
  return json.entry;
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
  const json = await readApiJson<
    PublishResponse & { error?: string; hint?: string }
  >(res);
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
  return readApiJson<ParseSmsResponse>(res);
}

export async function enrichTransport(
  places: ItineraryPlace[],
  forceRecalc = true,
  cityId?: MvpCityId,
  opts?: {
    startHour?: number;
    startTime?: string;
    lodgingReturnTime?: string;
    startLat?: number;
    startLng?: number;
    outboundTransportMode?: OutboundTransportMode;
  },
): Promise<{ places: ItineraryPlace[]; transportEngine?: string }> {
  const res = await apiFetch("/trip/enrich-transport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      places,
      forceRecalc,
      cityId,
      startHour: opts?.startHour,
      startTime: opts?.startTime,
      lodgingReturnTime: opts?.lodgingReturnTime || "21:00",
      startLat: opts?.startLat,
      startLng: opts?.startLng,
      outboundTransportMode: opts?.outboundTransportMode,
    }),
  });
  const json = await readApiJson<{
    places: ItineraryPlace[];
    transportEngine?: string;
    error?: string;
  }>(res);
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
  const json = await readApiJson<CompareTransportResponse & { error?: string }>(
    res,
  );
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
  const json = await readApiJson<{
    places: ItineraryPlace[];
    source?: string;
    googleMapsConfigured?: boolean;
    error?: string;
  }>(res);
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
  const json = await readApiJson<{
    results?: PlaceSearchResult[];
    source?: string;
    error?: string;
  }>(res);
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
  const json = await readApiJson<OptimizeDayResponse & { error?: string }>(res);
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
  const data = await readApiJson<{
    ok?: boolean;
    geminiConfigured?: boolean;
    wordpressConfigured?: boolean;
    googleMapsConfigured?: boolean;
    service?: string;
  }>(res);
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
