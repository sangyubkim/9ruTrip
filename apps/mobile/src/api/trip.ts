import { apiFetch, readApiJson } from "./client";
import type {
  ItineraryPlace,
  LodgingCandidate,
  MvpCityId,
  PlaceCategory,
  OutboundTransportMode,
  PlaceRef,
  RouteBriefing,
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
  preferredFestivals?: PreferredFestival[];
  /** 한국관광공사 추천 코스 시드 (선택) */
  tourCourse?: TourCourseSeed;
};

export type PreferredFestival = {
  id?: string;
  name: string;
  cityId: MvpCityId;
  startDate: string;
  endDate: string;
};

export type Festival = PreferredFestival & {
  id: string;
  cityName: string;
  lat: number;
  lng: number;
  distanceKm?: number;
};

export type TourCourseWaypoint = {
  order: number;
  name: string;
  contentId?: string;
  overview?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export type TourCourseListItem = {
  contentId: string;
  title: string;
  cityId?: MvpCityId;
  /** detailCommon2 overview 한줄 소개 (목록 enrichment) */
  overview?: string;
  distance?: string;
  takeTime?: string;
  theme?: string;
  address?: string;
  lat?: number;
  lng?: number;
  stopCount?: number;
  badge?: string;
  source?: string;
};

export type TourCourseDetail = TourCourseListItem & {
  waypoints: TourCourseWaypoint[];
  routeSummary?: string;
};

export type TourCourseSeed = {
  contentId: string;
  title: string;
  cityId?: MvpCityId;
  overview?: string;
  distance?: string;
  takeTime?: string;
  waypoints: TourCourseWaypoint[];
  routeSummary?: string;
};

export type SeedCourseMeta = {
  contentId: string;
  title: string;
  source?: string;
  stopCount?: number;
  routeSummary?: string;
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
  /** 구조화된 경로 구성·반영 내역 */
  routeBriefing?: RouteBriefing;
  seedCourse?: SeedCourseMeta;
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

export async function fetchFestivals(payload: {
  startDate: string;
  endDate: string;
  lat?: number;
  lng?: number;
  cityId?: string;
}): Promise<Festival[]> {
  const res = await apiFetch("/festivals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readApiJson<{ festivals?: Festival[]; error?: string }>(res);
  if (!res.ok) throw new Error(json.error ?? `Festival fetch failed: ${res.status}`);
  return json.festivals ?? [];
}

/** 서버 미배포·라우트 누락 시 영문 404를 빈 목록 UX로 흡수 */
function isCourseEndpointMissing(
  status: number,
  error?: string,
): boolean {
  if (status === 404) return true;
  return /^not found$/i.test(String(error || "").trim());
}

export async function fetchTourCourses(payload: {
  cityId: MvpCityId;
  limit?: number;
  lat?: number;
  lng?: number;
}): Promise<TourCourseListItem[]> {
  const res = await apiFetch("/trip/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readApiJson<{
    courses?: TourCourseListItem[];
    error?: string;
  }>(res);
  // 구버전 API(코스 라우트 없음)는 catch-all 404 "Not found" — 빈 목록으로 처리
  if (isCourseEndpointMissing(res.status, json.error)) {
    return [];
  }
  if (!res.ok) throw new Error(json.error ?? `Course list failed: ${res.status}`);
  return json.courses ?? [];
}

export async function fetchTourCourseDetail(payload: {
  contentId: string;
  cityId?: MvpCityId;
}): Promise<TourCourseDetail> {
  const res = await apiFetch("/trip/course-detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readApiJson<{
    course?: TourCourseDetail;
    error?: string;
  }>(res);
  if (!res.ok || !json.course) {
    throw new Error(json.error ?? `Course detail failed: ${res.status}`);
  }
  return json.course;
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
  const json = await readApiJson<RerouteResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error ?? `Reroute failed: ${res.status}`);
  }
  return json;
}

export type RegenerateDayRequest = {
  trip: Trip;
  dayIndex: number;
  /** 배정할 도시 (없으면 trip.cities / trip.cityId) */
  targetCityId?: MvpCityId;
};

export type RegenerateDayResponse = {
  places: ItineraryPlace[];
  plannedBudget: number;
  summary: string;
  engine: string;
  dayIndex: number;
  cityId: MvpCityId;
  replacedCount: number;
};

/** 도시 배정 변경 후 해당 Day 일정 통째 재생성 (전·후 Day 참고) */
export async function regenerateDay(
  payload: RegenerateDayRequest,
): Promise<RegenerateDayResponse> {
  const res = await apiFetch("/trip/regenerate-day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readApiJson<RegenerateDayResponse & { error?: string }>(
    res,
  );
  if (!res.ok) {
    throw new Error(json.error ?? `Regenerate day failed: ${res.status}`);
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

export async function deleteDiaryEntry(id: string): Promise<void> {
  const res = await apiFetch(`/diary/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await readApiJson<{ deleted?: boolean; error?: string }>(res);
  if (!res.ok || !json.deleted) {
    throw new Error(json.error ?? `Diary delete failed: ${res.status}`);
  }
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
  /** 검색 중심 위도 (현재 위치 또는 지정 장소) */
  lat?: number;
  /** 검색 중심 경도 */
  lng?: number;
  /** 지정 장소·주소명 (Google 텍스트 검색 보강) */
  nearQuery?: string;
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

export type EnrichedPlace = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  category: Exclude<PlaceCategory, "hotel">;
  estimatedCost: number;
  notes?: string;
  engine?: string;
};

export async function enrichPlace(payload: {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  cityId: string;
}): Promise<EnrichedPlace> {
  const res = await apiFetch("/places/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readApiJson<{ place?: EnrichedPlace; error?: string }>(res);
  if (!res.ok || !json.place) {
    throw new Error(json.error ?? `Place enrich failed: ${res.status}`);
  }
  return json.place;
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
