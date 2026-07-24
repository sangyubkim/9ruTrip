import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

const TOUCH_MIN = 44;

type HealthUi =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; detail: string }
  | { kind: "fail"; detail: string };

export function SettingsScreen({ onClose }: Props) {
  const { apiBaseUrl, setApiBaseUrl } = useApi();
  const { colors, mode, setMode } = useTheme();
  const [url, setUrl] = useState(apiBaseUrl);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [health, setHealth] = useState<HealthUi>({ kind: "idle" });

  const ping = async () => {
    setHealth({ kind: "loading" });
    try {
      await setApiBaseUrl(url.trim() || DEFAULT_API_BASE_URL);
      const h = await checkHealth();
      if (h.ok) {
        setHealth({
          kind: "ok",
          detail: `Gemini ${h.geminiConfigured ? "설정됨" : "미설정(폴백)"} · WP ${
            h.wordpressConfigured ? "설정됨" : "미설정"
          }`,
        });
      } else {
        setHealth({ kind: "fail", detail: "응답 이상" });
      }
    } catch (e) {
      setHealth({
        kind: "fail",
        detail: e instanceof Error ? e.message : "연결 실패",
      });
    }
  };

  useEffect(() => {
    void ping();
  }, []);

  const save = async () => {
    await setApiBaseUrl(url.trim() || DEFAULT_API_BASE_URL);
    Alert.alert("저장됨", "API 주소가 저장되었습니다.");
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
      <Text style={[styles.title, { color: colors.text }]}>설정</Text>

      <View
        style={[
          styles.healthCard,
          {
            backgroundColor: colors.bgElevated,
            borderColor:
              health.kind === "ok"
                ? colors.success
                : health.kind === "fail"
                  ? colors.danger
                  : colors.border,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={
          health.kind === "ok"
            ? "서버 연결됨"
            : health.kind === "fail"
              ? "서버 연결 안 됨"
              : "서버 연결 확인 중"
        }
      >
        {health.kind === "loading" || health.kind === "idle" ? (
          <View style={styles.healthRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.healthTitle, { color: colors.textSecondary }]}>
              서버 연결 확인 중…
            </Text>
          </View>
        ) : health.kind === "ok" ? (
          <>
            <Text style={[styles.healthTitle, { color: colors.success }]}>
              서버 연결됨 ✓
            </Text>
            <Text style={[styles.healthDetail, { color: colors.textMuted }]}>
              {health.detail}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.healthTitle, { color: colors.danger }]}>
              서버 연결 안 됨 ✗
            </Text>
            <Text style={[styles.healthDetail, { color: colors.textMuted }]}>
              {health.detail}
            </Text>
          </>
        )}
        <Pressable
          style={[styles.btn, { backgroundColor: colors.accentMuted }]}
          onPress={() => void ping()}
          accessibilityRole="button"
          accessibilityLabel="다시 연결 확인"
        >
          <Text style={[styles.btnText, { color: colors.accent }]}>
            다시 확인
          </Text>
        </Pressable>
      </View>

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

      <Pressable
        style={[styles.advancedToggle, { backgroundColor: colors.bgMuted }]}
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        accessibilityLabel="고급 설정"
      >
        <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>
          {advancedOpen ? "▾ 고급" : "▸ 고급"} · API 주소
        </Text>
      </Pressable>
      {advancedOpen ? (
        <View
          style={[
            styles.advancedBox,
            { borderColor: colors.border, backgroundColor: colors.bgElevated },
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            API Base URL
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            에뮬레이터: http://10.0.2.2:3011 · LAN 실기기: http://PC의IPv4:3011 ·
            외부망: https://….cloudwaysapps.com/apps/api (9ruDocs URL과 별개)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.bg,
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
        </View>
      ) : null}

      <Pressable
        style={styles.ghost}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="설정 닫기"
      >
        <Text style={[styles.ghostText, { color: colors.textMuted }]}>닫기</Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  healthCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  healthTitle: { fontSize: 18, fontWeight: "900" },
  healthDetail: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  label: { fontWeight: "600", marginTop: 8 },
  hint: { marginTop: 4, marginBottom: 8, fontSize: 12 },
  themeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  themeChip: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  advancedToggle: {
    marginTop: 8,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  advancedToggleText: { fontWeight: "700", fontSize: 14 },
  advancedBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    minHeight: TOUCH_MIN,
    justifyContent: "center",
  },
  btnText: { fontWeight: "700" },
  primary: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    minHeight: TOUCH_MIN,
    justifyContent: "center",
  },
  primaryText: { fontWeight: "700" },
  ghost: { marginTop: 16, alignItems: "center", padding: 8, minHeight: TOUCH_MIN },
  ghostText: {},
});
