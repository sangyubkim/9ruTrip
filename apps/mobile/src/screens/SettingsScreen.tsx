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
import { useTheme } from "../theme/ThemeContext";
import type { ThemeMode } from "../theme/tokens";

type Props = {
  onClose: () => void;
};

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "시스템" },
  { id: "light", label: "라이트" },
  { id: "dark", label: "다크" },
];

export function SettingsScreen({ onClose }: Props) {
  const { apiBaseUrl, setApiBaseUrl } = useApi();
  const { colors, mode, setMode } = useTheme();
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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>설정</Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>테마</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        시스템 Appearance를 따르거나 라이트/다크를 고정합니다.
      </Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map((opt) => {
          const on = mode === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[
                styles.themeChip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                },
              ]}
              onPress={() => void setMode(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`테마 ${opt.label}`}
            >
              <Text
                style={{
                  color: on ? colors.chipOnFg : colors.chipFg,
                  fontWeight: "700",
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        API Base URL
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Android 에뮬레이터 기본값: http://10.0.2.2:3011 · 실기기는 PC LAN IP
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
            color: colors.textSecondary,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={setUrl}
        placeholder={DEFAULT_API_BASE_URL}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="API Base URL"
      />
      {status ? (
        <Text style={[styles.status, { color: colors.accent }]}>{status}</Text>
      ) : null}
      <Pressable
        style={[styles.btn, { backgroundColor: colors.accentMuted }]}
        onPress={() => void ping()}
        accessibilityRole="button"
        accessibilityLabel="헬스 체크"
      >
        <Text style={[styles.btnText, { color: colors.accent }]}>
          헬스 체크
        </Text>
      </Pressable>
      <Pressable
        style={[styles.primary, { backgroundColor: colors.primary }]}
        onPress={() => void save()}
        accessibilityRole="button"
        accessibilityLabel="설정 저장"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          저장
        </Text>
      </Pressable>
      <Pressable
        style={styles.ghost}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="설정 닫기"
      >
        <Text style={[styles.ghostText, { color: colors.textMuted }]}>닫기</Text>
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
    padding: 16,
    zIndex: 20,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  label: { fontWeight: "600", marginTop: 8 },
  hint: { marginTop: 4, marginBottom: 8, fontSize: 12 },
  themeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  themeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  status: { marginTop: 10 },
  btn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { fontWeight: "700" },
  primary: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700" },
  ghost: { marginTop: 12, alignItems: "center", padding: 8 },
  ghostText: {},
});
