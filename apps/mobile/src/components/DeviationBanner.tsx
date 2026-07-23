import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  distanceKm: number | null;
  onReroute: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

/** GPS 이탈 시 비스팸 배너 — 재루트 CTA */
export function DeviationBanner({
  distanceKm,
  onReroute,
  onDismiss,
  busy,
}: Props) {
  const { colors, isDark } = useTheme();
  const dist =
    distanceKm != null && Number.isFinite(distanceKm)
      ? `약 ${distanceKm.toFixed(1)}km`
      : "";

  const bg = isDark ? "#431407" : "#fff7ed";
  const border = isDark ? "#ea580c" : "#fdba74";
  const kicker = isDark ? "#fdba74" : "#c2410c";
  const title = isDark ? "#ffedd5" : "#7c2d12";
  const meta = isDark ? "#fed7aa" : "#9a3412";

  return (
    <View
      style={[styles.banner, { backgroundColor: bg, borderColor: border }]}
      accessibilityRole="alert"
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: kicker }]}>경로 이탈</Text>
        <Text style={[styles.title, { color: title }]}>
          경로에서 벗어난 것 같아요 — 재루트할까요?
        </Text>
        {dist ? (
          <Text style={[styles.meta, { color: meta }]}>
            다음 장소까지 {dist}
          </Text>
        ) : null}
      </View>
      <Pressable
        style={[
          styles.btn,
          { backgroundColor: colors.danger },
          busy && { opacity: 0.6 },
        ]}
        disabled={busy}
        onPress={onReroute}
        accessibilityRole="button"
        accessibilityLabel="재루트"
      >
        <Text style={styles.btnText}>{busy ? "…" : "재루트"}</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="닫기"
      >
        <Text style={[styles.x, { color: meta }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: 1,
  },
  kicker: { fontSize: 11, fontWeight: "800" },
  title: {
    marginTop: 2,
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 19,
  },
  meta: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: radius.sm,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  dismiss: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  x: { fontSize: 16, fontWeight: "700" },
});
