import { StyleSheet, Text, View } from "react-native";
import { FadeIn } from "./FadeIn";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  message: string;
  /** success | info | warn — 기본 info(다크 바) */
  tone?: "info" | "success" | "warn";
  withFade?: boolean;
};

/** 화면 공통 인라인 피드백 — Alert 대신 가벼운 확인용 */
export function InlineToast({
  message,
  tone = "info",
  withFade = false,
}: Props) {
  const { colors, isDark } = useTheme();

  const bg =
    tone === "success"
      ? isDark
        ? "#052e16"
        : "#ecfdf5"
      : tone === "warn"
        ? isDark
          ? "#422006"
          : "#fffbeb"
        : colors.undoBg;
  const fg =
    tone === "success"
      ? isDark
        ? "#86efac"
        : "#047857"
      : tone === "warn"
        ? isDark
          ? "#fcd34d"
          : "#b45309"
        : colors.undoFg;

  const body = (
    <View
      style={[styles.box, { backgroundColor: bg }]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  );

  if (withFade) {
    return <FadeIn trigger={message}>{body}</FadeIn>;
  }
  return body;
}

const styles = StyleSheet.create({
  box: {
    marginTop: space.sm,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  text: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
