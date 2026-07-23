/** Open-Meteo (키 불필요) + 시간대 혼잡 휴리스틱 */

export type WeatherSnapshot = {
  temperatureC: number | null;
  precipitationProbability: number | null;
  /** 예: 오늘 날씨 · 22°C · 강수 30% */
  label: string;
  crowdHint: string;
  fetchedAt: string;
};

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
    `&timezone=Asia%2FTokyo`;

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
