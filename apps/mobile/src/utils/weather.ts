/** Open-Meteo (키 불필요) + 시간대 혼잡 휴리스틱 */

/**
 * 네이버 날씨 검색용 장소 라벨.
 * 상세주소(동/읍/면/리/로/길/번지)는 제거하고 시·군·구 단위까지만 남긴다.
 *
 * 예:
 * - "서울특별시 강남구 역삼동 …" → "서울 강남구"
 * - "경기도 하남시 감북동 …" → "하남시"
 * - "경기도 성남시 분당구 …" → "성남시 분당구"
 * - "강원도 정선군 …" → "정선군"
 * - "하남" / "서울" → 그대로
 */
export function toNaverWeatherPlaceLabel(addressOrCity: string): string {
  const input = String(addressOrCity ?? "").replace(/\s+/g, " ").trim();
  if (!input) return "";

  // 광역 표기 축약: 서울특별시 → 서울
  const normalized = input
    .replace(/([가-힣]+)특별자치시/g, "$1")
    .replace(/([가-힣]+)특별시/g, "$1")
    .replace(/([가-힣]+)광역시/g, "$1");

  const adminMatches = normalized.match(/[가-힣]+(?:시|군|구)/g) ?? [];
  // 도 단위(경기도 등)는 시|군|구 패턴에 안 걸림

  if (adminMatches.length > 0) {
    const lastGuGunIdx = (() => {
      for (let i = adminMatches.length - 1; i >= 0; i -= 1) {
        if (/[군구]$/.test(adminMatches[i]!)) return i;
      }
      return -1;
    })();

    if (lastGuGunIdx >= 0) {
      const district = adminMatches[lastGuGunIdx]!;
      const prevAdmin =
        lastGuGunIdx > 0 ? adminMatches[lastGuGunIdx - 1]! : undefined;
      if (prevAdmin && /시$/.test(prevAdmin)) {
        return `${prevAdmin} ${district}`;
      }
      // "서울 강남구"처럼 축약 광역명이 구 앞에 있는 경우
      const districtAt = normalized.indexOf(district);
      const before = normalized
        .slice(0, Math.max(0, districtAt))
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .filter((t) => !/(?:특별자치)?도$/.test(t));
      const prev = before[before.length - 1];
      if (
        prev &&
        prev !== district &&
        !/(?:동|읍|면|리|로|길)$/.test(prev) &&
        !/\d/.test(prev)
      ) {
        return `${prev} ${district}`;
      }
      return district;
    }

    // 구/군 없이 시만 있는 경우 → 마지막 시 (하남시, 제주시)
    const cities = adminMatches.filter((a) => /시$/.test(a));
    if (cities.length) return cities[cities.length - 1]!;
    return adminMatches[adminMatches.length - 1]!;
  }

  // 시·군·구가 없으면 도시명(서울, 하남)으로 보고 상세 토큰 이전까지만
  const kept: string[] = [];
  for (const token of normalized.split(" ").filter(Boolean)) {
    if (/(?:특별자치)?도$/.test(token)) continue;
    if (/(?:동|읍|면|리|로|길)$/.test(token) || /\d/.test(token) || /번지/.test(token)) {
      break;
    }
    kept.push(token);
  }
  return (kept[0] ?? normalized.split(" ")[0] ?? "").trim();
}

export type WeatherSnapshot = {
  temperatureC: number | null;
  precipitationProbability: number | null;
  /** 예: 오늘 날씨 · 22°C · 강수 30% */
  label: string;
  crowdHint: string;
  fetchedAt: string;
};

export type DailyWeather = {
  date: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationProbability: number | null;
  weatherLabel: string;
  /** 예: 7/28 · 맑음 · 18–26°C · 강수 20% */
  label: string;
};

function weatherCodeLabel(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) return "예보 없음";
  if (code === 0) return "맑음";
  if (code <= 3) return "구름";
  if (code <= 48) return "안개";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 99) return "뇌우";
  return "변동";
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${Number(month)}/${Number(day)}` : isoDate;
}

export function crowdHintForHour(hour = new Date().getHours()): string {
  if (hour >= 11 && hour <= 13) return "점심 혼잡 가능";
  if (hour >= 17 && hour <= 19) return "저녁 혼잡 가능";
  if (hour >= 9 && hour <= 10) return "오전 이동 여유";
  if (hour >= 14 && hour <= 16) return "오후 관광 피크";
  return "비교적 여유";
}

export async function fetchCityWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot> {
  const crowdHint = crowdHintForHour();
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,precipitation_probability` +
    `&timezone=Asia%2FSeoul`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        precipitation_probability?: number;
      };
    };
    const temp =
      typeof json.current?.temperature_2m === "number"
        ? Math.round(json.current.temperature_2m)
        : null;
    const precip =
      typeof json.current?.precipitation_probability === "number"
        ? Math.round(json.current.precipitation_probability)
        : null;
    const parts = ["오늘 날씨"];
    if (temp != null) parts.push(`${temp}°C`);
    if (precip != null) parts.push(`강수 ${precip}%`);
    return {
      temperatureC: temp,
      precipitationProbability: precip,
      label: parts.join(" · "),
      crowdHint,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      temperatureC: null,
      precipitationProbability: null,
      label: "오늘 날씨 · 불러오기 실패",
      crowdHint,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/** 여행 기간 일별 예보 (Open-Meteo daily, 보통 향후 ~16일) */
export async function fetchDateRangeWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<DailyWeather[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=Asia%2FSeoul` +
    `&start_date=${encodeURIComponent(startDate)}` +
    `&end_date=${encodeURIComponent(endDate)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather range ${res.status}`);
  const json = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: Array<number | null>;
      temperature_2m_min?: Array<number | null>;
      precipitation_probability_max?: Array<number | null>;
      weather_code?: Array<number | null>;
    };
  };
  const times = json.daily?.time ?? [];
  return times.map((date, index) => {
    const max =
      typeof json.daily?.temperature_2m_max?.[index] === "number"
        ? Math.round(json.daily!.temperature_2m_max![index] as number)
        : null;
    const min =
      typeof json.daily?.temperature_2m_min?.[index] === "number"
        ? Math.round(json.daily!.temperature_2m_min![index] as number)
        : null;
    const precip =
      typeof json.daily?.precipitation_probability_max?.[index] === "number"
        ? Math.round(
            json.daily!.precipitation_probability_max![index] as number,
          )
        : null;
    const code = json.daily?.weather_code?.[index];
    const weatherLabel = weatherCodeLabel(
      typeof code === "number" ? code : null,
    );
    const parts = [formatShortDate(date), weatherLabel];
    if (min != null && max != null) parts.push(`${min}–${max}°C`);
    else if (max != null) parts.push(`${max}°C`);
    if (precip != null) parts.push(`강수 ${precip}%`);
    return {
      date,
      temperatureMaxC: max,
      temperatureMinC: min,
      precipitationProbability: precip,
      weatherLabel,
      label: parts.join(" · "),
    };
  });
}
