import { Alert, Linking } from "react-native";

/** 네이버 검색 결과 화면 열기 (검색어 = query) */
export async function openNaverSearch(query: string) {
  const q = String(query || "").trim();
  if (!q) return;
  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("검색 실패", "네이버 검색을 열 수 없습니다.");
  }
}
