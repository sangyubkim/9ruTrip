import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { checkHealth } from "../api/trip";
import { useApi } from "../context/ApiContext";
import { DEFAULT_API_BASE_URL } from "../config";

type Props = {
  onClose: () => void;
};

export function SettingsScreen({ onClose }: Props) {
  const { apiBaseUrl, setApiBaseUrl } = useApi();
  const [url, setUrl] = useState(apiBaseUrl);
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    await setApiBaseUrl(url.trim() || DEFAULT_API_BASE_URL);
    Alert.alert("저장됨", "API 주소가 저장되었습니다.");
    onClose();
  };

  const ping = async () => {
    try {
      await setApiBaseUrl(url.trim() || DEFAULT_API_BASE_URL);
      const h = await checkHealth();
      setStatus(
        h.ok
          ? `OK · Gemini ${h.geminiConfigured ? "설정됨" : "미설정(폴백)"} · WP ${
              h.wordpressConfigured ? "설정됨" : "미설정"
            }`
          : "응답 이상",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "연결 실패");
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>설정</Text>
      <Text style={styles.label}>API Base URL</Text>
      <Text style={styles.hint}>
        Android 에뮬레이터 기본값: http://10.0.2.2:3011 · 실기기는 PC LAN IP
      </Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={setUrl}
        placeholder={DEFAULT_API_BASE_URL}
      />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable style={styles.btn} onPress={() => void ping()}>
        <Text style={styles.btnText}>헬스 체크</Text>
      </Pressable>
      <Pressable style={styles.primary} onPress={() => void save()}>
        <Text style={styles.primaryText}>저장</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={onClose}>
        <Text style={styles.ghostText}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#f8fafc",
    padding: 16,
    zIndex: 20,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  label: { fontWeight: "600", color: "#334155" },
  hint: { marginTop: 4, marginBottom: 8, color: "#94a3b8", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  status: { marginTop: 10, color: "#0369a1" },
  btn: {
    marginTop: 12,
    backgroundColor: "#e0f2fe",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#075985", fontWeight: "700" },
  primary: {
    marginTop: 10,
    backgroundColor: "#0369a1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  ghost: { marginTop: 12, alignItems: "center", padding: 8 },
  ghostText: { color: "#64748b" },
});
