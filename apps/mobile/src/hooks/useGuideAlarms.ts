import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import type { Trip } from "../types";
import { getNextAction } from "../utils/nextAction";

let Notifications: typeof import("expo-notifications") | null = null;
try {
  // Expo Go / 네이티브 모듈 없으면 인앱 Alert만 사용
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications || Platform.OS !== "android") return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    const existing = (await Notifications.getPermissionsAsync()) as {
      granted?: boolean;
      status?: string;
    };
    if (existing.granted || existing.status === "granted") return true;
    const requested = (await Notifications.requestPermissionsAsync()) as {
      granted?: boolean;
      status?: string;
    };
    return Boolean(requested.granted || requested.status === "granted");
  } catch {
    return false;
  }
}

/**
 * 여행 중 가이드 알람:
 * 1) 다음 일정 배너용 nextAction 계산은 화면에서
 * 2) 임박 시 인앱 Alert + (가능하면) Android 로컬 알림
 */
export function useGuideAlarms(
  trip: Trip | null,
  enabled: boolean,
  onPrompt?: (message: string) => void,
) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!trip || !enabled || trip.status !== "active") return;

    const tick = async () => {
      const next = getNextAction(trip);
      if (!next || (!next.isDue && !next.isOverdue)) return;

      const key = `${next.place.id}-${next.isOverdue ? "over" : "due"}`;
      if (lastKey.current === key) return;
      lastKey.current = key;

      const when =
        next.minutesUntil == null
          ? "곧"
          : next.minutesUntil >= 0
            ? `${next.minutesUntil}분 후`
            : `${Math.abs(next.minutesUntil)}분 지남`;

      const msg = `${next.dayLabel} 다음: ${next.place.name}${
        next.place.plannedTime ? ` (${next.place.plannedTime})` : ""
      } · ${when}`;

      onPrompt?.(msg);
      Alert.alert("가이드 알림", msg);

      const ok = await ensureNotificationPermission();
      if (ok && Notifications) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "9ruTrip 다음 일정",
              body: msg,
              sound: true,
            },
            trigger: null,
          });
        } catch {
          // ignore — 인앱 Alert로 충분
        }
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 60_000);
    return () => clearInterval(id);
  }, [trip, enabled, onPrompt]);
}
