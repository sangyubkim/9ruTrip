import { Linking, Platform } from "react-native";

export type LatLng = { lat: number; lng: number; name?: string };

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
