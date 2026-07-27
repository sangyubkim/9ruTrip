import { CITIES, isKnownCityId, resolveCity } from "./cities.mjs";

const TOUR_API_ENDPOINT =
  "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const TOUR_API_PAGE_SIZE = 100;
const TOUR_API_MAX_PAGES = 3;
const TOUR_API_TIMEOUT_MS = 10_000;
const TOUR_API_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const tourApiCache = new Map();

const FESTIVAL_CATALOG = [
  { id: "taebaek-snow", name: "태백산눈축제", cityId: "taebaek", startMonth: 1, startDay: 24, endMonth: 2, endDay: 2, lat: 37.164, lng: 128.985 },
  { id: "hwacheon-san", name: "화천산천어축제", cityId: "chuncheon", startMonth: 1, startDay: 11, endMonth: 2, endDay: 2, lat: 38.106, lng: 127.708 },
  { id: "pyeongchang-trout", name: "평창송어축제", cityId: "pyeongchang", startMonth: 1, startDay: 3, endMonth: 2, endDay: 2, lat: 37.514, lng: 128.433 },
  { id: "namhae-garlic", name: "남해보물섬마늘축제", cityId: "namhae", startMonth: 5, startDay: 24, endMonth: 5, endDay: 26, lat: 34.837, lng: 127.892 },
  { id: "jeju-fire", name: "제주들불축제", cityId: "jeju", startMonth: 3, startDay: 14, endMonth: 3, endDay: 16, lat: 33.429, lng: 126.679 },
  { id: "gwangyang-plum", name: "광양매화축제", cityId: "gwangyang", startMonth: 3, startDay: 7, endMonth: 3, endDay: 16, lat: 34.980, lng: 127.719 },
  { id: "yeongdeok-snowcrab", name: "영덕대게축제", cityId: "yeongdeok", startMonth: 3, startDay: 14, endMonth: 3, endDay: 17, lat: 36.360, lng: 129.389 },
  { id: "jinhae-cherry", name: "진해군항제", cityId: "changwon", startMonth: 3, startDay: 29, endMonth: 4, endDay: 6, lat: 35.156, lng: 128.659 },
  { id: "goryeosan-azalea", name: "고려산진달래축제", cityId: "incheon", startMonth: 4, startDay: 6, endMonth: 4, endDay: 14, lat: 37.704, lng: 126.429 },
  { id: "cheongdo-bullfight", name: "청도소싸움축제", cityId: "cheongdo", startMonth: 4, startDay: 11, endMonth: 4, endDay: 14, lat: 35.647, lng: 128.734 },
  { id: "goyang-flower", name: "고양국제꽃박람회", cityId: "goyang", startMonth: 4, startDay: 26, endMonth: 5, endDay: 12, lat: 37.655, lng: 126.768 },
  { id: "taean-tulip", name: "태안세계튤립꽃박람회", cityId: "taean", startMonth: 4, startDay: 10, endMonth: 5, endDay: 7, lat: 36.611, lng: 126.298 },
  { id: "damyang-bamboo", name: "담양대나무축제", cityId: "damyang", startMonth: 5, startDay: 11, endMonth: 5, endDay: 15, lat: 35.321, lng: 126.988 },
  { id: "hadong-tea", name: "하동야생차문화축제", cityId: "hadong", startMonth: 5, startDay: 11, endMonth: 5, endDay: 15, lat: 35.062, lng: 127.755 },
  { id: "gwangalli-eobang", name: "광안리어방축제", cityId: "busan", startMonth: 5, startDay: 10, endMonth: 5, endDay: 12, lat: 35.154, lng: 129.119 },
  { id: "chuncheon-mime", name: "춘천마임축제", cityId: "chuncheon", startMonth: 5, startDay: 26, endMonth: 6, endDay: 2, lat: 37.881, lng: 127.73 },
  { id: "gangneung-dano", name: "강릉단오제", cityId: "gangneung", startMonth: 6, startDay: 6, endMonth: 6, endDay: 13, lat: 37.751, lng: 128.891 },
  { id: "muju-firefly", name: "무주반딧불축제", cityId: "namwon", startMonth: 6, startDay: 1, endMonth: 6, endDay: 9, lat: 36.006, lng: 127.661 },
  { id: "busan-sea", name: "부산바다축제", cityId: "busan", startMonth: 8, startDay: 1, endMonth: 8, endDay: 4, lat: 35.158, lng: 129.161 },
  { id: "boryeong-mud", name: "보령머드축제", cityId: "boryeong", startMonth: 7, startDay: 19, endMonth: 8, endDay: 4, lat: 36.305, lng: 126.516 },
  { id: "jangheung-water", name: "정남진 장흥 물축제", cityId: "jangheung", startMonth: 7, startDay: 27, endMonth: 8, endDay: 4, lat: 34.682, lng: 126.907 },
  { id: "bonghwa-sweetfish", name: "봉화 은어축제", cityId: "bonghwa", startMonth: 7, startDay: 27, endMonth: 8, endDay: 4, lat: 36.893, lng: 128.732 },
  { id: "geoje-summer-marine", name: "거제여름해양축제", cityId: "geoje", startMonth: 7, startDay: 26, endMonth: 8, endDay: 4, lat: 34.880, lng: 128.622 },
  { id: "daegu-donggu-summer", name: "대구 동구 여름축제", cityId: "daegu", startMonth: 7, startDay: 26, endMonth: 7, endDay: 28, lat: 35.886, lng: 128.635 },
  { id: "pyeongchang-cool", name: "평창더위사냥축제", cityId: "pyeongchang", startMonth: 7, startDay: 26, endMonth: 8, endDay: 4, lat: 37.514, lng: 128.433 },
  { id: "taebaek-sunflower", name: "태백 해바라기축제", cityId: "taebaek", startMonth: 7, startDay: 19, endMonth: 8, endDay: 15, lat: 37.139, lng: 128.989 },
  { id: "andong-soopesta", name: "안동 수페스타", cityId: "andong", startMonth: 7, startDay: 27, endMonth: 8, endDay: 4, lat: 36.568, lng: 128.729 },
  { id: "hongcheon-esports", name: "홍천 e스포츠 축제", cityId: "hongcheon", startMonth: 7, startDay: 26, endMonth: 7, endDay: 28, lat: 37.697, lng: 127.889 },
  { id: "inje-smelt", name: "인제빙어축제", cityId: "inje", startMonth: 7, startDay: 26, endMonth: 8, endDay: 4, lat: 38.069, lng: 128.170 },
  { id: "samcheok-beach", name: "삼척비치썸페스티벌", cityId: "samcheok", startMonth: 7, startDay: 26, endMonth: 8, endDay: 4, lat: 37.448, lng: 129.165 },
  { id: "yangyang-surf", name: "양양서핑페스티벌", cityId: "yangyang", startMonth: 7, startDay: 20, endMonth: 7, endDay: 21, lat: 38.075, lng: 128.619 },
  { id: "ulsan-whale", name: "울산조선해양축제", cityId: "ulsan", startMonth: 7, startDay: 19, endMonth: 7, endDay: 21, lat: 35.492, lng: 129.425 },
  { id: "pohang-fireworks", name: "포항국제불빛축제", cityId: "pohang", startMonth: 5, startDay: 31, endMonth: 6, endDay: 2, lat: 36.054, lng: 129.378 },
  { id: "buyeo-lotus", name: "부여서동연꽃축제", cityId: "gongju", startMonth: 7, startDay: 5, endMonth: 7, endDay: 7, lat: 36.275, lng: 126.913 },
  { id: "geumsan-ginseng", name: "금산세계인삼축제", cityId: "nonsan", startMonth: 10, startDay: 3, endMonth: 10, endDay: 13, lat: 36.105, lng: 127.488 },
  { id: "miryang-summer", name: "밀양여름공연예술축제", cityId: "miryang", startMonth: 7, startDay: 24, endMonth: 8, endDay: 4, lat: 35.503, lng: 128.747 },
  { id: "changnyeong-onion", name: "창녕양파&마늘축제", cityId: "changnyeong", startMonth: 6, startDay: 13, endMonth: 6, endDay: 16, lat: 35.545, lng: 128.492 },
  { id: "sancheong-herb", name: "산청한방약초축제", cityId: "sancheong", startMonth: 9, startDay: 27, endMonth: 10, endDay: 6, lat: 35.416, lng: 127.874 },
  { id: "geochang-apple", name: "거창한마당대축제", cityId: "geochang", startMonth: 9, startDay: 26, endMonth: 9, endDay: 29, lat: 35.687, lng: 127.910 },
  { id: "cheongju-craft", name: "청주공예비엔날레", cityId: "cheongju", startMonth: 9, startDay: 1, endMonth: 10, endDay: 15, lat: 36.642, lng: 127.489 },
  { id: "andong-mask", name: "안동국제탈춤페스티벌", cityId: "andong", startMonth: 9, startDay: 27, endMonth: 10, endDay: 6, lat: 36.568, lng: 128.729 },
  { id: "gimje-horizon", name: "김제지평선축제", cityId: "gimje", startMonth: 10, startDay: 2, endMonth: 10, endDay: 6, lat: 35.802, lng: 126.88 },
  { id: "jeonju-bibimbap", name: "전주비빔밥축제", cityId: "jeonju", startMonth: 10, startDay: 9, endMonth: 10, endDay: 13, lat: 35.815, lng: 127.153 },
  { id: "jinju-lantern", name: "진주남강유등축제", cityId: "jinju", startMonth: 10, startDay: 5, endMonth: 10, endDay: 20, lat: 35.184, lng: 128.081 },
  { id: "gangjin-celadon", name: "강진청자축제", cityId: "jangheung", startMonth: 2, startDay: 22, endMonth: 3, endDay: 3, lat: 34.639, lng: 126.767 },
  { id: "namwon-chunhyang", name: "남원춘향제", cityId: "namwon", startMonth: 5, startDay: 10, endMonth: 5, endDay: 16, lat: 35.416, lng: 127.390 },
  { id: "icheon-rice", name: "이천쌀문화축제", cityId: "icheon", startMonth: 10, startDay: 16, endMonth: 10, endDay: 20, lat: 37.272, lng: 127.435 },
  { id: "suwon-hwaseong", name: "수원화성문화제", cityId: "suwon", startMonth: 10, startDay: 4, endMonth: 10, endDay: 6, lat: 37.287, lng: 127.015 },
  { id: "seoul-lantern", name: "서울빛초롱축제", cityId: "seoul", startMonth: 12, startDay: 13, endMonth: 12, endDay: 31, lat: 37.57, lng: 126.978 },
  { id: "busan-fireworks", name: "부산불꽃축제", cityId: "busan", startMonth: 11, startDay: 9, endMonth: 11, endDay: 9, lat: 35.153, lng: 129.119 },
  { id: "seoul-rose", name: "서울장미축제", cityId: "seoul", startMonth: 5, startDay: 18, endMonth: 5, endDay: 25, lat: 37.580, lng: 127.087 },
  { id: "yeosu-nightsea", name: "여수밤바다불꽃축제", cityId: "yeosu", startMonth: 10, startDay: 19, endMonth: 10, endDay: 19, lat: 34.761, lng: 127.665 },
  { id: "jeongseon-arirang", name: "정선아리랑제", cityId: "jeongseon", startMonth: 10, startDay: 2, endMonth: 10, endDay: 5, lat: 37.380, lng: 128.661 },
  { id: "boseong-tea", name: "보성다향대축제", cityId: "boseong", startMonth: 5, startDay: 3, endMonth: 5, endDay: 7, lat: 34.771, lng: 127.080 },
  { id: "haenam-mihwangsa", name: "해남미남축제", cityId: "haenam", startMonth: 11, startDay: 1, endMonth: 11, endDay: 3, lat: 34.573, lng: 126.599 },
  { id: "uljin-crab", name: "울진대게와 붉은대게축제", cityId: "uljin", startMonth: 2, startDay: 22, endMonth: 2, endDay: 25, lat: 36.993, lng: 129.400 },
];

function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function dateAt(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function festivalDatesForYear(festival, year) {
  const startDate = dateAt(year, festival.startMonth, festival.startDay);
  const endsNextYear =
    festival.endMonth < festival.startMonth ||
    (festival.endMonth === festival.startMonth && festival.endDay < festival.startDay);
  const endDate = dateAt(year + Number(endsNextYear), festival.endMonth, festival.endDay);
  return { startDate, endDate };
}

function festivalOccurrenceOverlaps(startDate, endDate, festival) {
  const tripStart = new Date(`${startDate}T00:00:00Z`);
  const tripEnd = new Date(`${endDate}T23:59:59Z`);
  if (Number.isNaN(tripStart.valueOf()) || Number.isNaN(tripEnd.valueOf()) || tripStart > tripEnd) return null;
  for (let year = tripStart.getUTCFullYear() - 1; year <= tripEnd.getUTCFullYear() + 1; year += 1) {
    const occurrence = festivalDatesForYear(festival, year);
    if (occurrence.startDate <= tripEnd && occurrence.endDate >= tripStart) return occurrence;
  }
  return null;
}

function catalogFestivals({ startDate, endDate, lat, lng, cityId }) {
  const origin =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : isKnownCityId(cityId)
        ? resolveCity(cityId).center
        : null;
  return FESTIVAL_CATALOG.map((festival) => ({ festival, occurrence: festivalOccurrenceOverlaps(startDate, endDate, festival) }))
    .filter(({ occurrence }) => occurrence)
    .map(({ festival, occurrence }) => ({
    id: festival.id,
    name: festival.name,
    cityId: festival.cityId,
    lat: festival.lat,
    lng: festival.lng,
    startDate: formatDate(occurrence.startDate),
    endDate: formatDate(occurrence.endDate),
    cityName: resolveCity(festival.cityId).nameKo,
    distanceKm: origin ? Math.round(haversineKm(origin, festival)) : undefined,
  }));
}

function originForFestivalDistance(lat, lng, cityId) {
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (isKnownCityId(cityId)) return resolveCity(cityId).center;
  return null;
}

function sortFestivals(festivals) {
  return festivals.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.name.localeCompare(b.name, "ko") ||
      a.id.localeCompare(b.id),
  );
}

function normalizedCityKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_-]|시|군|구|city|county|gun|si/g, "");
}

function resolveFestivalCityId(festival) {
  const directId = String(festival?.cityId || "").trim();
  if (isKnownCityId(directId) && resolveCity(directId).countryId === "kr") return directId;
  const key = normalizedCityKey(directId || festival?.cityName || festival?.location);
  const matched = Object.values(CITIES).find(
    (city) =>
      city.countryId === "kr" &&
      [city.id, city.nameKo, city.nameEn].some((value) => normalizedCityKey(value) === key),
  );
  if (matched) return matched.id;

  const festivalLat = Number(festival?.lat);
  const festivalLng = Number(festival?.lng);
  if (!Number.isFinite(festivalLat) || !Number.isFinite(festivalLng)) return null;
  const nearest = Object.values(CITIES)
    .filter((city) => city.countryId === "kr")
    .map((city) => ({ city, distanceKm: haversineKm({ lat: festivalLat, lng: festivalLng }, city.center) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  return nearest?.distanceKm <= 60 ? nearest.city.id : null;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function tourApiDate(value) {
  const compact = String(value || "").trim();
  if (!/^\d{8}$/.test(compact)) return null;
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return isValidDateString(date) ? date : null;
}

function datesOverlap(startDate, endDate, tripStart, tripEnd) {
  return (
    new Date(`${startDate}T00:00:00Z`) <= tripEnd &&
    new Date(`${endDate}T23:59:59Z`) >= tripStart
  );
}

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

async function fetchTourApiItems({ serviceKey, startDate, endDate }) {
  const items = [];
  const eventStartDate = startDate.replaceAll("-", "");
  for (let pageNo = 1; pageNo <= TOUR_API_MAX_PAGES; pageNo += 1) {
    const params = new URLSearchParams({
      serviceKey: decodedServiceKey(serviceKey),
      MobileOS: "ETC",
      MobileApp: "9ruTrip",
      eventStartDate,
      eventEndDate: endDate.replaceAll("-", ""),
      _type: "json",
      numOfRows: String(TOUR_API_PAGE_SIZE),
      pageNo: String(pageNo),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOUR_API_TIMEOUT_MS);
    try {
      const response = await fetch(`${TOUR_API_ENDPOINT}?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`TourAPI ${response.status}`);
      const data = await response.json();
      const header = data?.response?.header;
      if (header?.resultCode && header.resultCode !== "0000") {
        throw new Error(`TourAPI ${header.resultCode}: ${header.resultMsg || ""}`);
      }
      const pageItems = tourApiItems(data);
      items.push(...pageItems);
      if (pageItems.length < TOUR_API_PAGE_SIZE) break;
    } finally {
      clearTimeout(timer);
    }
  }
  return items;
}

function normalizeTourApiFestivals(items, { startDate, endDate, lat, lng, cityId }) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return [];
  const tripStart = new Date(`${startDate}T00:00:00Z`);
  const tripEnd = new Date(`${endDate}T23:59:59Z`);
  if (tripStart > tripEnd) return [];
  const origin = originForFestivalDistance(lat, lng, cityId);

  return sortFestivals(items
    .map((item) => {
      const festivalStartDate = tourApiDate(item?.eventstartdate);
      const festivalEndDate = tourApiDate(item?.eventenddate);
      const festivalLat = Number(item?.mapy);
      const festivalLng = Number(item?.mapx);
      const contentId = String(item?.contentid || "").trim();
      const resolvedCityId = resolveFestivalCityId({
        cityName: item?.addr1,
        location: item?.addr1,
        lat: festivalLat,
        lng: festivalLng,
      });
      if (
        !String(item?.title || "").trim() ||
        !contentId ||
        !festivalStartDate ||
        !festivalEndDate ||
        festivalStartDate > festivalEndDate ||
        !Number.isFinite(festivalLat) ||
        !Number.isFinite(festivalLng) ||
        festivalLat < -90 ||
        festivalLat > 90 ||
        festivalLng < -180 ||
        festivalLng > 180 ||
        !datesOverlap(festivalStartDate, festivalEndDate, tripStart, tripEnd)
      ) {
        return null;
      }
      return {
        id: `tour-${contentId}`,
        name: String(item.title).trim().slice(0, 80),
        cityId: resolvedCityId || "unknown",
        cityName: resolvedCityId
          ? resolveCity(resolvedCityId).nameKo
          : String(item?.addr1 || "지역 정보 없음").trim().slice(0, 120),
        startDate: festivalStartDate,
        endDate: festivalEndDate,
        lat: festivalLat,
        lng: festivalLng,
        distanceKm: origin
          ? Math.round(haversineKm(origin, { lat: festivalLat, lng: festivalLng }))
          : undefined,
      };
    })
    .filter(Boolean));
}

async function listTourApiFestivals(input, serviceKey) {
  const cacheKey = `${input.startDate}|${input.endDate}|${input.lat}|${input.lng}|${input.cityId}`;
  const cached = tourApiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.festivals;

  const items = await fetchTourApiItems({
    serviceKey,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  const festivals = normalizeTourApiFestivals(items, input);
  if (festivals.length) {
    tourApiCache.set(cacheKey, {
      festivals,
      expiresAt: Date.now() + TOUR_API_CACHE_TTL_MS,
    });
  }
  return festivals;
}

export function clearFestivalCache() {
  tourApiCache.clear();
}

export async function listFestivals(body, env) {
  const startDate = String(body?.startDate || "");
  const endDate = String(body?.endDate || "");
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const cityId = String(body?.cityId || "");
  const fallback = sortFestivals(
    catalogFestivals({ startDate, endDate, lat, lng, cityId }),
  );
  const serviceKey = String(env?.tourApiServiceKey || "").trim();
  if (!serviceKey) return { festivals: fallback, source: "catalog" };

  try {
    const festivals = await listTourApiFestivals(
      { startDate, endDate, lat, lng, cityId },
      serviceKey,
    );
    return {
      festivals: festivals.length ? festivals : fallback,
      source: festivals.length ? "tourapi" : "catalog",
    };
  } catch {
    return { festivals: fallback, source: "catalog" };
  }
}
