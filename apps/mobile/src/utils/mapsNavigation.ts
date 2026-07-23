import { Linking, Platform } from "react-native";

export type LatLng = { lat: number; lng: number; name?: string };

function pointLabel(point: LatLng, fallback: string): string {
  const name = String(point?.name || "").trim();
  if (name) return name;
  if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
  }
  return fallback;
}

/**
 * Google Maps 길안내 URL (Android intent 우선, 실패 시 https).
 * travelmode=transit — 앱에서는 일본 대중교통이 열림 (Directions API와 별개).
 */
export function buildGoogleMapsDirectionsUrl(
  destination: LatLng,
  origin?: LatLng | null,
): string {
  const dest = `${Number(destination.lat)},${Number(destination.lng)}`;
  const params = new URLSearchParams({
    api: "1",
    destination: dest,
    travelmode: "transit",
  });
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("origin", `${Number(origin.lat)},${Number(origin.lng)}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Yahoo!地図 환승(train) deep link — 공식 URL 스펙 (fromLat/fromLon/toLat/toLon).
 * @see https://map.yahoo.co.jp/blog/archives/20220218_map_urlspec.html
 */
export function buildYahooTransitUrl(
  destination: LatLng,
  origin?: LatLng | null,
): string {
  const toLat = Number(destination.lat);
  const toLon = Number(destination.lng);
  if (!Number.isFinite(toLat) || !Number.isFinite(toLon)) return "";

  const params = new URLSearchParams();
  params.set("to", pointLabel(destination, "到着"));
  params.set("toLat", String(toLat));
  params.set("toLon", String(toLon));

  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("from", pointLabel(origin, "出発"));
    params.set("fromLat", String(Number(origin.lat)));
    params.set("fromLon", String(Number(origin.lng)));
  } else {
    params.set("from", "現在地");
  }

  return `https://map.yahoo.co.jp/route/train?${params.toString()}`;
}

/** Android google.navigation 스키마 (턴바이턴). 좌표만. */
export function buildAndroidNavigationIntent(destination: LatLng): string {
  return `google.navigation:q=${Number(destination.lat)},${Number(destination.lng)}&mode=t`;
}

export async function openMapsDirections(
  destination: LatLng,
  origin?: LatLng | null,
): Promise<void> {
  const httpsUrl = buildGoogleMapsDirectionsUrl(destination, origin);

  if (Platform.OS === "android") {
    const intent = buildAndroidNavigationIntent(destination);
    try {
      const can = await Linking.canOpenURL(intent);
      if (can) {
        await Linking.openURL(intent);
        return;
      }
    } catch {
      /* fall through to https */
    }
  }

  await Linking.openURL(httpsUrl);
}

export async function openYahooTransit(
  destination: LatLng,
  origin?: LatLng | null,
): Promise<void> {
  const url = buildYahooTransitUrl(destination, origin);
  if (!url) {
    throw new Error("Yahoo 환승 URL을 만들 수 없습니다.");
  }
  await Linking.openURL(url);
}

/** deepLinks 객체가 있으면 우선, 없으면 좌표로 생성 */
export async function openTransitDeepLink(
  which: "google" | "yahoo",
  destination: LatLng,
  origin?: LatLng | null,
  deepLinks?: { google?: string; yahoo?: string } | null,
): Promise<void> {
  if (which === "yahoo") {
    const url = deepLinks?.yahoo || buildYahooTransitUrl(destination, origin);
    if (!url) throw new Error("Yahoo 환승 URL이 없습니다.");
    await Linking.openURL(url);
    return;
  }
  const url =
    deepLinks?.google || buildGoogleMapsDirectionsUrl(destination, origin);
  if (!url) throw new Error("Google 환승 URL이 없습니다.");
  if (which === "google" && Platform.OS === "android" && !deepLinks?.google) {
    await openMapsDirections(destination, origin);
    return;
  }
  await Linking.openURL(url);
}
