import { Platform } from "react-native";

type ExpoLocation = typeof import("expo-location");

export type DeviceCoords = {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** lastKnown 등 캐시 좌표 사용 여부 */
  fromCache: boolean;
};

let LocationModule: ExpoLocation | null | undefined;

function getLocationModule(): ExpoLocation | null {
  if (LocationModule !== undefined) return LocationModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LocationModule = require("expo-location");
  } catch {
    LocationModule = null;
  }
  return LocationModule;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} (${Math.round(ms / 1000)}초 초과)`));
      }, ms);
    }),
  ]);
}

export function isDeviceLocationAvailable(): boolean {
  return Platform.OS !== "web" && Boolean(getLocationModule());
}

/** 권한 확인 후 필요할 때만 요청. 이미 granted면 request를 다시 호출하지 않음(Android hang 방지). */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const Location = getLocationModule();
  if (!Location || Platform.OS === "web") return false;
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === "granted") return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.status === "granted";
}

/**
 * 현재 위치 조회.
 * - getCurrentPositionAsync가 무한 대기할 수 있어 타임아웃 + lastKnown 폴백 사용
 */
export async function getDeviceCoords({
  timeoutMs = 10_000,
  maxCacheAgeMs = 5 * 60_000,
  staleCacheAgeMs = 30 * 60_000,
}: {
  timeoutMs?: number;
  maxCacheAgeMs?: number;
  staleCacheAgeMs?: number;
} = {}): Promise<DeviceCoords> {
  const Location = getLocationModule();
  if (!Location || Platform.OS === "web") {
    throw new Error("이 환경에서는 GPS를 사용할 수 없습니다.");
  }

  const granted = await ensureForegroundLocationPermission();
  if (!granted) {
    throw new Error("현재 위치를 쓰려면 위치 권한이 필요합니다.");
  }

  const accuracy = Location.Accuracy?.Balanced ?? 3;

  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: maxCacheAgeMs,
      requiredAccuracy: 200,
    });
    if (
      last?.coords &&
      Number.isFinite(last.coords.latitude) &&
      Number.isFinite(last.coords.longitude)
    ) {
      // 빠른 응답 후, 최신 고정은 짧게 시도 (실패해도 캐시 유지)
      try {
        const fresh = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy }),
          Math.min(4_000, timeoutMs),
          "위치 갱신",
        );
        if (
          fresh?.coords &&
          Number.isFinite(fresh.coords.latitude) &&
          Number.isFinite(fresh.coords.longitude)
        ) {
          return {
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            accuracy:
              typeof fresh.coords.accuracy === "number"
                ? fresh.coords.accuracy
                : null,
            fromCache: false,
          };
        }
      } catch {
        /* use last known */
      }
      return {
        lat: last.coords.latitude,
        lng: last.coords.longitude,
        accuracy:
          typeof last.coords.accuracy === "number" ? last.coords.accuracy : null,
        fromCache: true,
      };
    }
  } catch {
    /* continue to current */
  }

  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy }),
      timeoutMs,
      "GPS 수신",
    );
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy:
        typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
      fromCache: false,
    };
  } catch (err) {
    try {
      const stale = await Location.getLastKnownPositionAsync({
        maxAge: staleCacheAgeMs,
      });
      if (
        stale?.coords &&
        Number.isFinite(stale.coords.latitude) &&
        Number.isFinite(stale.coords.longitude)
      ) {
        return {
          lat: stale.coords.latitude,
          lng: stale.coords.longitude,
          accuracy:
            typeof stale.coords.accuracy === "number"
              ? stale.coords.accuracy
              : null,
          fromCache: true,
        };
      }
    } catch {
      /* ignore */
    }
    throw err instanceof Error
      ? err
      : new Error("현재 위치를 가져오지 못했습니다.");
  }
}

export async function reverseGeocodeLabel(
  lat: number,
  lng: number,
  { timeoutMs = 5_000 }: { timeoutMs?: number } = {},
): Promise<string | null> {
  const Location = getLocationModule();
  if (!Location) return null;
  try {
    const geos = await withTimeout(
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
      timeoutMs,
      "주소 변환",
    );
    const g = geos?.[0];
    if (!g) return null;
    const parts = [
      g.region,
      g.city || g.subregion,
      g.district,
      g.street,
      g.name,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  } catch {
    return null;
  }
}
