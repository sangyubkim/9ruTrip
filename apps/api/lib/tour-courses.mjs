/**
 * 한국관광공사 TourAPI 추천 코스 (contentTypeId=25).
 * 역할: 공식 경유지/테마 순서 시드 — AI 일정의 최종 스케줄이 아님.
 */
import { isKnownCityId, resolveCity } from "./cities.mjs";
import { cleanTourText } from "./tourapi.mjs";

const AREA_BASED_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";
const LOCATION_BASED_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";
const DETAIL_COMMON_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const DETAIL_INTRO_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/detailIntro2";
const DETAIL_INFO_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/detailInfo2";

const COURSE_CONTENT_TYPE = "25";
const TOUR_API_TIMEOUT_MS = 10_000;
const TOUR_API_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RADIUS_M = 40_000;
const DETAIL_CONCURRENCY = 4;
const DEFAULT_LIST_LIMIT = 8;
/** 목록 카드용 한줄 소개 길이 (detailCommon2 overview) */
const LIST_BRIEFING_MAX_LEN = 100;

const courseCache = new Map();

/** TourAPI areaCode (광역) — 도시 id → 코드 */
const AREA_CODE_BY_CITY = {
  seoul: "1",
  incheon: "2",
  daejeon: "3",
  daegu: "4",
  gwangju: "5",
  busan: "6",
  ulsan: "7",
  sejong: "8",
  // 경기
  suwon: "31",
  seongnam: "31",
  uijeongbu: "31",
  anyang: "31",
  bucheon: "31",
  gwangmyeong: "31",
  pyeongtaek: "31",
  dongducheon: "31",
  ansan: "31",
  goyang: "31",
  gwacheon: "31",
  guri: "31",
  namyangju: "31",
  osan: "31",
  siheung: "31",
  gunpo: "31",
  uiwang: "31",
  hanam: "31",
  yongin: "31",
  paju: "31",
  icheon: "31",
  anseong: "31",
  gimpo: "31",
  hwaseong: "31",
  gwangju_gyeonggi: "31",
  yangju: "31",
  pocheon: "31",
  yeoju: "31",
  gapyeong: "31",
  yangpyeong: "31",
  // 강원
  chuncheon: "32",
  gangneung: "32",
  donghae: "32",
  samcheok: "32",
  sokcho: "32",
  wonju: "32",
  taebaek: "32",
  pyeongchang: "32",
  hongcheon: "32",
  yangyang: "32",
  inje: "32",
  jeongseon: "32",
  // 충북
  cheongju: "33",
  chungju: "33",
  jecheon: "33",
  daniyang: "33",
  // 충남
  gyeryong: "34",
  gongju: "34",
  nonsan: "34",
  dangjin: "34",
  boryeong: "34",
  seosan: "34",
  asan: "34",
  cheonan: "34",
  taean: "34",
  // 전북
  jeonju: "37",
  jeongeup: "37",
  gunsan: "37",
  gimje: "37",
  namwon: "37",
  iksan: "37",
  // 전남
  yeosu: "38",
  suncheon: "38",
  mokpo: "38",
  gwangyang: "38",
  naju: "38",
  jangheung: "38",
  boseong: "38",
  damyang: "38",
  haenam: "38",
  // 경북
  gyeongju: "35",
  gimcheon: "35",
  andong: "35",
  gumi: "35",
  yeongju: "35",
  yeongcheon: "35",
  sangju: "35",
  mungyeong: "35",
  gyeongsan: "35",
  pohang: "35",
  bonghwa: "35",
  cheongdo: "35",
  yeongdeok: "35",
  uljin: "35",
  // 경남
  changwon: "36",
  tongyeong: "36",
  geoje: "36",
  gimhae: "36",
  miryang: "36",
  sacheon: "36",
  yangsan: "36",
  jinju: "36",
  changnyeong: "36",
  hadong: "36",
  sancheong: "36",
  geochang: "36",
  namhae: "36",
  // 제주
  jeju: "39",
  seogwipo: "39",
};

function decodedServiceKey(serviceKey) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function tourApiItems(data) {
  const items = data?.response?.body?.items?.item;
  return Array.isArray(items) ? items : items ? [items] : [];
}

function cacheGet(key) {
  const hit = courseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    courseCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  courseCache.set(key, {
    value,
    expiresAt: Date.now() + TOUR_API_CACHE_TTL_MS,
  });
}

export function clearTourCourseCache() {
  courseCache.clear();
}

function isDomesticCityId(cityId) {
  if (!isKnownCityId(cityId)) return false;
  const city = resolveCity(cityId);
  return city.region === "domestic" || city.countryId === "kr";
}

/** cityId → TourAPI areaCode (없으면 null) */
export function resolveTourAreaCode(cityId) {
  const id = String(cityId || "").trim();
  if (!id || !AREA_CODE_BY_CITY[id]) return null;
  return AREA_CODE_BY_CITY[id];
}

function parseCoord(latRaw, lngRaw) {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return { lat, lng };
}

async function tourApiGet(endpoint, params, serviceKey) {
  const search = new URLSearchParams({
    serviceKey: decodedServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "9ruTrip",
    _type: "json",
    ...params,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOUR_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpoint}?${search}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TourAPI ${response.status}`);
    const data = await response.json();
    const header = data?.response?.header;
    if (header?.resultCode && header.resultCode !== "0000") {
      throw new Error(
        `TourAPI ${header.resultCode}: ${header.resultMsg || ""}`,
      );
    }
    return tourApiItems(data);
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(concurrency, list.length));
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/**
 * detailCommon2 overview → 목록용 한줄 소개.
 * list API(areaBasedList2 등)에는 overview가 없으므로 enrichment 결과/상세에서만 의미가 있음.
 * addr1(주소)는 개요가 아니므로 쓰지 않는다.
 */
export function formatCourseListBriefing(raw, maxLen = LIST_BRIEFING_MAX_LEN) {
  const len = Number.isFinite(Number(maxLen))
    ? Math.max(40, Math.min(160, Number(maxLen)))
    : LIST_BRIEFING_MAX_LEN;
  return cleanTourText(raw, len);
}

/**
 * areaBasedList2 / locationBasedList2 항목 → 코스 카드
 * overview/distance/takeTime은 list 응답에 보통 없고, enrich 단계에서 채운다.
 */
export function normalizeTourCourseListItem(item, cityId) {
  const contentId = String(item?.contentid || "").trim();
  const title = String(item?.title || "").trim();
  if (!contentId || !title) return null;
  const coords = parseCoord(item?.mapy, item?.mapx);
  const overview = formatCourseListBriefing(item?.overview);
  const distance = cleanTourText(item?.distance, 40);
  const takeTime = cleanTourText(item?.taketime || item?.takeTime, 40);
  const theme = cleanTourText(item?.theme, 80);
  return {
    contentId,
    title: title.slice(0, 80),
    cityId: isDomesticCityId(cityId) ? cityId : undefined,
    overview: overview || undefined,
    distance: distance || undefined,
    takeTime: takeTime || undefined,
    theme: theme || undefined,
    lat: coords?.lat,
    lng: coords?.lng,
    address: cleanTourText(item?.addr1, 120),
    badge: "관광공사",
    source: "한국관광공사",
  };
}

/**
 * detailInfo2 코스 구간 → waypoint (좌표 없으면 lat/lng 생략 — 발명 금지)
 */
export function normalizeTourCourseWaypoint(item, index = 0) {
  const name = String(
    item?.subname || item?.subdetailalt || item?.title || "",
  ).trim();
  if (!name) return null;
  const subContentId = String(
    item?.subcontentid || item?.subcontentId || "",
  ).trim();
  const coords = parseCoord(
    item?.mapy ?? item?.submapy,
    item?.mapx ?? item?.submapx,
  );
  const orderRaw = Number(item?.subnum ?? item?.subNum ?? index + 1);
  const order = Number.isFinite(orderRaw) && orderRaw > 0 ? orderRaw : index + 1;
  return {
    order,
    name: name.slice(0, 80),
    contentId: subContentId || undefined,
    overview: cleanTourText(item?.subdetailoverview, 160),
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };
}

export function formatCourseWaypointSummary(waypoints) {
  const named = (waypoints || [])
    .map((w) => String(w?.name || "").trim())
    .filter(Boolean);
  if (!named.length) return "";
  if (named.length === 1) return named[0];
  return named.join(" → ");
}

function mergeCourseIntoPool(pool, waypoints, cityId) {
  const next = {
    attraction: [...(pool?.attraction || [])],
    food: [...(pool?.food || [])],
    hotel: [...(pool?.hotel || [])],
  };
  const seen = new Set(
    next.attraction.map((p) => p.contentId || p.id || p.name),
  );
  const seeded = [];
  for (const wp of waypoints || []) {
    if (
      !wp?.name ||
      !Number.isFinite(Number(wp.lat)) ||
      !Number.isFinite(Number(wp.lng))
    ) {
      continue;
    }
    const contentId = String(wp.contentId || "").trim();
    const id = contentId ? `tour-${contentId}` : `course-wp-${wp.order}`;
    const key = contentId || id || wp.name;
    if (seen.has(key) || seen.has(wp.name)) continue;
    seen.add(key);
    seen.add(wp.name);
    const place = {
      id,
      contentId: contentId || undefined,
      name: wp.name,
      category: "attraction",
      lat: Number(wp.lat),
      lng: Number(wp.lng),
      notes: wp.overview || "관광공사 추천 코스 경유지",
      address: wp.address,
      cityId,
      mustVisit: true,
      courseOrder: wp.order,
    };
    seeded.push(place);
  }
  next.attraction = [...seeded, ...next.attraction];
  return { pool: next, seeded };
}

/** 시드용: 좌표 있는 경유지만 TourAPI attraction 후보로 병합 */
export function injectCourseWaypointsIntoPool(pool, waypoints, cityId) {
  return mergeCourseIntoPool(pool, waypoints, cityId);
}

export function formatCourseSeedForPrompt(course) {
  if (!course?.title || !Array.isArray(course.waypoints)) return "";
  const withCoords = course.waypoints.filter(
    (w) =>
      w?.name &&
      Number.isFinite(Number(w.lat)) &&
      Number.isFinite(Number(w.lng)),
  );
  if (!withCoords.length) return "";
  const lines = withCoords.map(
    (w) =>
      `- #${w.order} ${w.name} (${w.lat}, ${w.lng})${w.contentId ? ` id=tour-${w.contentId}` : ""}`,
  );
  return [
    `한국관광공사 추천 코스 시드(선택): "${course.title}"`,
    "이 코스는 공식 경유지/테마 순서입니다. AI가 식사·숙소·이동·체류(60분)·시간창을 채워 최종 일정을 만드세요.",
    "경유지를 우선 attraction 후보로 쓰고, 코스 순서를 가급적 존중하되 동선·식사 시간(11–14 / 18–20)에 맞게 재배치해도 됩니다.",
    "코스를 그대로 하루 일정에 복붙하지 마세요. 좌표 없는 경유지는 만들지 마세요.",
    "경유지 목록:",
    ...lines,
  ].join("\n");
}

async function fetchCourseCommon(contentId, serviceKey) {
  const items = await tourApiGet(
    DETAIL_COMMON_ENDPOINT,
    {
      contentId: String(contentId),
      defaultYN: "Y",
      addrinfoYN: "Y",
      overviewYN: "Y",
      mapinfoYN: "Y",
    },
    serviceKey,
  ).catch(() => []);
  return items[0] || {};
}

async function fetchCourseIntro(contentId, serviceKey) {
  const items = await tourApiGet(
    DETAIL_INTRO_ENDPOINT,
    {
      contentId: String(contentId),
      contentTypeId: COURSE_CONTENT_TYPE,
    },
    serviceKey,
  ).catch(() => []);
  return items[0] || {};
}

/**
 * 목록 카드용: detailCommon2 overview + detailIntro2 distance/taketime.
 * 실패해도 원본 카드는 유지 (제목/주소만으로 선택 가능).
 */
async function enrichTourCourseListItem(course, serviceKey) {
  if (!course?.contentId || !serviceKey) return course;
  const cacheKey = `list-enrich|${course.contentId}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return {
      ...course,
      overview: cached.overview || course.overview,
      distance: cached.distance || course.distance,
      takeTime: cached.takeTime || course.takeTime,
      theme: cached.theme || course.theme,
      address: course.address || cached.address,
    };
  }

  const [common, intro] = await Promise.all([
    fetchCourseCommon(course.contentId, serviceKey),
    fetchCourseIntro(course.contentId, serviceKey),
  ]);

  const overview =
    formatCourseListBriefing(common.overview) || course.overview;
  const distance =
    cleanTourText(intro.distance, 40) || course.distance;
  const takeTime =
    cleanTourText(intro.taketime, 40) || course.takeTime;
  const theme = cleanTourText(intro.theme, 80) || course.theme;
  const address =
    course.address ||
    cleanTourText(
      [common.addr1, common.addr2].filter(Boolean).join(" "),
      120,
    );

  const enrichment = {
    overview: overview || undefined,
    distance: distance || undefined,
    takeTime: takeTime || undefined,
    theme: theme || undefined,
    address: address || undefined,
  };
  cacheSet(cacheKey, enrichment);
  return { ...course, ...enrichment };
}

async function fetchWaypointCoords(contentId, serviceKey) {
  if (!contentId) return null;
  const cacheKey = `wp-coord|${contentId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const common = await fetchCourseCommon(contentId, serviceKey);
  const coords = parseCoord(common.mapy, common.mapx);
  if (!coords) return null;
  const result = {
    ...coords,
    address: cleanTourText(
      [common.addr1, common.addr2].filter(Boolean).join(" "),
      120,
    ),
    overview: cleanTourText(common.overview, 160),
  };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * 도시별 추천 코스 목록 (areaBasedList2 → locationBasedList2 폴백)
 */
export async function listTourCourses({
  cityId,
  serviceKey,
  limit = DEFAULT_LIST_LIMIT,
  lat,
  lng,
} = {}) {
  const key = String(serviceKey || "").trim();
  if (!key || !isDomesticCityId(cityId)) {
    return { courses: [], source: "none" };
  }

  const city = resolveCity(cityId);
  const areaCode = resolveTourAreaCode(cityId);
  const numOfRows = Math.max(1, Math.min(20, Number(limit) || DEFAULT_LIST_LIMIT));
  const mapY = Number.isFinite(Number(lat)) ? Number(lat) : city.center.lat;
  const mapX = Number.isFinite(Number(lng)) ? Number(lng) : city.center.lng;
  const cacheKey = `list|${cityId}|${numOfRows}|${areaCode || "loc"}|${mapY.toFixed(3)},${mapX.toFixed(3)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let items = [];
  let source = "none";

  if (areaCode) {
    try {
      items = await tourApiGet(
        AREA_BASED_ENDPOINT,
        {
          areaCode: String(areaCode),
          contentTypeId: COURSE_CONTENT_TYPE,
          arrange: "Q",
          listYN: "Y",
          numOfRows: String(numOfRows),
          pageNo: "1",
        },
        key,
      );
      if (items.length) source = "areaBasedList2";
    } catch {
      items = [];
    }
  }

  if (!items.length) {
    try {
      items = await tourApiGet(
        LOCATION_BASED_ENDPOINT,
        {
          mapX: String(mapX),
          mapY: String(mapY),
          radius: String(DEFAULT_RADIUS_M),
          contentTypeId: COURSE_CONTENT_TYPE,
          arrange: "E",
          numOfRows: String(numOfRows),
          pageNo: "1",
        },
        key,
      );
      if (items.length) source = "locationBasedList2";
    } catch {
      items = [];
    }
  }

  const baseCourses = items
    .map((item) => normalizeTourCourseListItem(item, cityId))
    .filter(Boolean)
    .slice(0, numOfRows)
    .map((course) => ({
      ...course,
      stopCount: undefined,
    }));

  // list API에는 overview가 없음 → detailCommon2/detailIntro2로 top N 보강 (concurrency 4)
  const courses = await mapWithConcurrency(
    baseCourses,
    DETAIL_CONCURRENCY,
    async (course) => {
      try {
        return await enrichTourCourseListItem(course, key);
      } catch {
        return course;
      }
    },
  );

  const result = { courses, source };
  if (courses.length) cacheSet(cacheKey, result);
  return result;
}

/**
 * 코스 상세 + 경유지 (detailInfo2). 좌표 없는 스탑은 유지하되 lat/lng는 넣지 않음.
 */
export async function fetchTourCourseDetail({
  contentId,
  cityId,
  serviceKey,
} = {}) {
  const key = String(serviceKey || "").trim();
  const id = String(contentId || "").trim();
  if (!key || !id) return null;

  const cacheKey = `detail|${id}|${cityId || ""}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const [common, intro, infoItems] = await Promise.all([
    fetchCourseCommon(id, key),
    fetchCourseIntro(id, key),
    tourApiGet(
      DETAIL_INFO_ENDPOINT,
      {
        contentId: id,
        contentTypeId: COURSE_CONTENT_TYPE,
        numOfRows: "50",
        pageNo: "1",
      },
      key,
    ).catch(() => []),
  ]);

  let waypoints = infoItems
    .map((item, index) => normalizeTourCourseWaypoint(item, index))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  waypoints = await mapWithConcurrency(
    waypoints,
    DETAIL_CONCURRENCY,
    async (wp) => {
      if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) return wp;
      if (!wp.contentId) return wp;
      const coords = await fetchWaypointCoords(wp.contentId, key).catch(
        () => null,
      );
      if (!coords) return wp;
      return {
        ...wp,
        lat: coords.lat,
        lng: coords.lng,
        address: wp.address || coords.address,
        overview: wp.overview || coords.overview,
      };
    },
  );

  const courseCoords = parseCoord(common.mapy, common.mapx);
  const title =
    String(common.title || "").trim().slice(0, 80) ||
    `코스 ${id}`;
  const overview =
    cleanTourText(common.overview, 200) ||
    cleanTourText(intro.schedule, 120);
  const detail = {
    contentId: id,
    title,
    cityId: isDomesticCityId(cityId) ? cityId : undefined,
    overview: overview || undefined,
    distance: cleanTourText(intro.distance, 40),
    takeTime: cleanTourText(intro.taketime, 40),
    theme: cleanTourText(intro.theme, 80),
    lat: courseCoords?.lat,
    lng: courseCoords?.lng,
    address: cleanTourText(
      [common.addr1, common.addr2].filter(Boolean).join(" "),
      120,
    ),
    badge: "관광공사",
    source: "한국관광공사",
    stopCount: waypoints.length,
    waypoints,
    routeSummary: formatCourseWaypointSummary(waypoints),
  };

  cacheSet(cacheKey, detail);
  return detail;
}

export async function listTourCoursesForRequest(body, env) {
  const cityId = String(body?.cityId || "").trim();
  const limit = Number(body?.limit) || DEFAULT_LIST_LIMIT;
  const serviceKey = String(env?.tourApiServiceKey || "").trim();
  if (!serviceKey) {
    return { courses: [], source: "none", error: "TOUR_API_SERVICE_KEY missing" };
  }
  if (!isDomesticCityId(cityId)) {
    return { courses: [], source: "none", error: "국내 도시만 지원합니다." };
  }
  try {
    return await listTourCourses({
      cityId,
      serviceKey,
      limit,
      lat: body?.lat,
      lng: body?.lng,
    });
  } catch (err) {
    return {
      courses: [],
      source: "none",
      error: err?.message || "course list failed",
    };
  }
}

export async function fetchTourCourseDetailForRequest(body, env) {
  const contentId = String(body?.contentId || body?.id || "").trim();
  const cityId = String(body?.cityId || "").trim();
  const serviceKey = String(env?.tourApiServiceKey || "").trim();
  if (!serviceKey) {
    return { course: null, error: "TOUR_API_SERVICE_KEY missing" };
  }
  if (!contentId) {
    return { course: null, error: "contentId가 필요합니다." };
  }
  try {
    const course = await fetchTourCourseDetail({
      contentId,
      cityId: isDomesticCityId(cityId) ? cityId : undefined,
      serviceKey,
    });
    return { course };
  } catch (err) {
    return { course: null, error: err?.message || "course detail failed" };
  }
}

/**
 * generateItinerary body에서 tourCourse 정규화
 */
export function normalizeTourCourseSeed(raw, cityIds = []) {
  const source = raw?.tourCourse || raw?.preferredCourse || raw;
  if (!source || typeof source !== "object") return null;
  const contentId = String(source.contentId || source.id || "").trim();
  const title = String(source.title || source.name || "").trim();
  if (!contentId || !title) return null;
  const waypoints = (Array.isArray(source.waypoints) ? source.waypoints : [])
    .map((wp, index) => {
      if (!wp || typeof wp.name !== "string" || !wp.name.trim()) return null;
      const order = Number(wp.order) > 0 ? Number(wp.order) : index + 1;
      const coords = parseCoord(wp.lat, wp.lng);
      const wpContentId = String(wp.contentId || "").trim();
      return {
        order,
        name: wp.name.trim().slice(0, 80),
        contentId: wpContentId || undefined,
        overview: cleanTourText(wp.overview, 160),
        address: cleanTourText(wp.address, 120),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .slice(0, 30);

  const cityId = String(source.cityId || cityIds[0] || "").trim();
  return {
    contentId,
    title: title.slice(0, 80),
    cityId: isDomesticCityId(cityId) ? cityId : cityIds.find(isDomesticCityId),
    overview: cleanTourText(source.overview, 200),
    distance: cleanTourText(source.distance, 40),
    takeTime: cleanTourText(source.takeTime || source.taketime, 40),
    waypoints,
    stopCount: waypoints.length,
    routeSummary:
      cleanTourText(source.routeSummary, 200) ||
      formatCourseWaypointSummary(waypoints),
    source: "한국관광공사",
    badge: "관광공사",
  };
}
