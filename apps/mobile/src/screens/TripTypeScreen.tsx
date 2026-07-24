import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  onBack: () => void;
  onSelectDomestic: () => void;
};

export function TripTypeScreen({ onBack, onSelectDomestic }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Pressable
        onPress={onBack}
        style={styles.backHit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <Text style={[styles.back, { color: colors.accent }]}>← 뒤로</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>여행 유형</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        국내 여행 또는 해외 여행을 선택하세요.
      </Text>

      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.primary,
          },
        ]}
        onPress={onSelectDomestic}
        accessibilityRole="button"
        accessibilityLabel="국내 여행"
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>국내 여행</Text>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>
          서울 · 부산 · 제주 등 한국 여행
        </Text>
      </Pressable>

      <View
        style={[
          styles.card,
          styles.cardDisabled,
          {
            backgroundColor: colors.bgMuted,
            borderColor: colors.border,
          },
        ]}
        accessibilityState={{ disabled: true }}
        accessibilityLabel="해외 여행 준비 중"
      >
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
          해외 여행
        </Text>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>
          준비 중 · 곧 지원 예정
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.chipBg }]}>
          <Text style={[styles.badgeText, { color: colors.chipFg }]}>
            비활성
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 2,
  },
  back: { fontSize: 15, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  hint: {
    marginTop: space.sm,
    marginBottom: space.xl,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    minHeight: 96,
    justifyContent: "center",
  },
  cardDisabled: { opacity: 0.72 },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  cardSub: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
});
