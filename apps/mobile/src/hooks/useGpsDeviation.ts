import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type { Trip } from "../types";
import { getNextAction } from "../utils/nextAction";
import { haversineKm } from "../utils/geo";

let Location: typeof import("expo-location") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require("expo-location");
} catch {
  Location = null;
}

export type GpsDeviationState = {
  /** 다음 장소에서 thresholdKm 이상 떨어짐 */
  deviant: boolean;
  distanceKm: number | null;
  /** granted | denied | undetermined | unavailable */
  permission: "granted" | "denied" | "undetermined" | "unavailable";
  /** 배너 닫기 (같은 이탈 구간에서 재표시 억제) */
  dismiss: () => void;
  /** 사용자가 닫지 않았고 deviant일 때 true */
  showBanner: boolean;
};

const DEFAULT_THRESHOLD_KM = 1.5;
const POLL_MS = 45_000;

/**
 * 여행 active + aiRerouteEnabled 일 때 주기/포커스 시 GPS 확인.
 * 다음 미완료 장소와 >1.5km 이면 이탈 힌트 (스팸 방지: dismiss 후 같은 place+구간 억제).
 * 권한 거부는 조용히 무시.
 */
export function useGpsDeviation(
  trip: Trip | null,
  enabled: boolean,
  thresholdKm = DEFAULT_THRESHOLD_KM,
): GpsDeviationState {
  const [deviant, setDeviant] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [permission, setPermission] = useState<GpsDeviationState["permission"]>(
    Location ? "undetermined" : "unavailable",
  );
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const lastPlaceId = useRef<string | null>(null);

  const dismiss = useCallback(() => {
    const next = trip ? getNextAction(trip) : null;
    if (next) {
      setDismissedKey(`${next.place.id}-${Math.floor((distanceKm ?? 0) * 2)}`);
    } else {
      setDismissedKey("dismissed");
    }
  }, [trip, distanceKm]);

  const check = useCallback(async () => {
    if (!trip || !enabled || trip.status !== "active" || !trip.aiRerouteEnabled) {
      setDeviant(false);
      setDistanceKm(null);
      return;
    }
    if (!Location || Platform.OS === "web") {
      setPermission("unavailable");
      return;
    }

    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") {
          setPermission("denied");
          setDeviant(false);
          return;
        }
      }
      setPermission("granted");

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.Balanced ?? 3,
      });
      const next = getNextAction(trip);
      if (!next?.place) {
        setDeviant(false);
        setDistanceKm(null);
        return;
      }

      if (lastPlaceId.current !== next.place.id) {
        lastPlaceId.current = next.place.id;
        setDismissedKey(null);
      }

      const km = haversineKm(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        { lat: next.place.lat, lng: next.place.lng },
      );
      setDistanceKm(km);
      setDeviant(Number.isFinite(km) && km > thresholdKm);
    } catch {
      // 권한/모듈 오류 — 배너 없이 종료
      setDeviant(false);
    }
  }, [trip, enabled, thresholdKm]);

  useEffect(() => {
    if (!enabled || !trip || trip.status !== "active" || !trip.aiRerouteEnabled) {
      setDeviant(false);
      return;
    }

    void check();
    const id = setInterval(() => void check(), POLL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") void check();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [trip, enabled, check]);

  const next = trip ? getNextAction(trip) : null;
  const dismissKey =
    next && distanceKm != null
      ? `${next.place.id}-${Math.floor(distanceKm * 2)}`
      : null;
  const showBanner =
    deviant &&
    permission === "granted" &&
    dismissKey != null &&
    dismissedKey !== dismissKey &&
    dismissedKey !== "dismissed";

  return {
    deviant,
    distanceKm,
    permission,
    dismiss,
    showBanner,
  };
}
