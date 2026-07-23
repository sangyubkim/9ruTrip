import AsyncStorage from "@react-native-async-storage/async-storage";

export type PlanUiMode = "easy" | "detailed";

const KEY = "@9rutrip/planUiMode";

export async function loadPlanUiMode(): Promise<PlanUiMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "detailed" || v === "easy") return v;
    return "easy";
  } catch {
    return "easy";
  }
}

export async function savePlanUiMode(mode: PlanUiMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
