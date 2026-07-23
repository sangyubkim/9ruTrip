import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@9rutrip/onboardingSeen";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
