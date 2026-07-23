import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_API_BASE_URL } from "../config";
import type { ThemeMode } from "../theme/tokens";

const KEY = "@9rutrip/apiBaseUrl";
const THEME_KEY = "@9rutrip/themeMode";

export async function loadApiBaseUrl(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v?.trim() || DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export async function saveApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY, url.replace(/\/$/, ""));
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return "system";
  } catch {
    return "system";
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, mode);
}
