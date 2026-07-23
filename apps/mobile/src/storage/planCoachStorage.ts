import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@9rutrip/planCoachSeen";

export async function hasSeenPlanCoach(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markPlanCoachSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
