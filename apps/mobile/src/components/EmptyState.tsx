import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { space } from "../theme/tokens";

type Props = {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** 장식용 짧은 이모지/기호 (접근성에서는 무시) */
  glyph?: string;
};

/** 빈 목록·첫 사용 안내 — 제품감 있는 공통 빈 상태 */
export function EmptyState({
  title,
  body,
  ctaLabel,
  onCta,
  glyph = "◇",
}: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.bgElevated,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="summary"
    >
      <View
        style={[styles.glyphWrap, { backgroundColor: colors.accentMuted }]}
        importantForAccessibility="no"
      >
        <Text style={[styles.glyph, { color: colors.accent }]}>{glyph}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
      {ctaLabel && onCta ? (
        <Pressable
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaText, { color: colors.primaryFg }]}>
            {ctaLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: space.lg,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: space.sm,
  },
  glyphWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  glyph: { fontSize: 22, fontWeight: "700" },
  title: {
    fontWeight: "800",
    fontSize: 17,
    marginBottom: space.sm,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: space.md,
  },
  cta: {
    marginTop: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  ctaText: { fontWeight: "800", fontSize: 15 },
});
