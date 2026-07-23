import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_API_BASE_URL } from "../config";

const KEY = "@9rutrip/apiBaseUrl";

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
