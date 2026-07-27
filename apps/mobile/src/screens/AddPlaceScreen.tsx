import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { radius, space, type } from "../theme/tokens";
import type { PlaceCategory } from "../types";
import { CATEGORY_LABEL } from "../utils/cost";

type Props = {
  dayIndex: number;
  suggesting?: boolean;
  onBack: () => void;
  onSuggestCategory: (category: PlaceCategory) => void;
  onOpenManualPlace: () => void;
};

const SUGGEST_CATS: PlaceCategory[] = ["food", "attraction", "hotel"];

/**
 * 경로 카드 사이 `+`에서 진입하는 장소 추가 화면.
 * 맛집/관광/숙소 제안과 「일정 장소」직접 추가를 한곳에서 처리한다.
 */
export function AddPlaceScreen({
  dayIndex,
  suggesting = false,
  onBack,
  onSuggestCategory,
  onOpenManualPlace,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, space.sm),
          paddingBottom: Math.max(insets.bottom, space.md),
        },
      ]}
    >
      <Pressable
        onPress={onBack}
        style={styles.backHit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="일정으로 돌아가기"
      >
        <Text style={[styles.back, { color: colors.accent }]}>← 일정</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.text }]}>
        장소 추가 · Day {dayIndex + 1}
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        추천에서 고르거나, 아래 일정 장소로 직접 추가할 수 있습니다.
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>추천 추가</Text>
      <View style={styles.insertRow}>
        {SUGGEST_CATS.map((c) => (
          <Pressable
            key={c}
            style={[
              styles.insertBtn,
              { backgroundColor: colors.accentMuted, borderColor: colors.border },
              suggesting && { opacity: 0.6 },
            ]}
            disabled={suggesting}
            onPress={() => onSuggestCategory(c)}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_LABEL[c] || c} 추가`}
          >
            {suggesting ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.insertText, { color: colors.accent }]}>
                +{CATEGORY_LABEL[c] || c}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted, marginTop: space.sm }]}>
        +숙소는 숙박일 전체에 반영될 수 있습니다.
      </Text>

      <Text
        style={[
          styles.sectionLabel,
          { color: colors.text, marginTop: space.lg },
        ]}
      >
        일정 장소
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        AI 추천에 없는 장소도 현재 Day에 추가할 수 있습니다.
      </Text>
      <Pressable
        style={[
          styles.manualBtn,
          { backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
        onPress={onOpenManualPlace}
        accessibilityRole="button"
        accessibilityLabel="장소 직접 추가"
      >
        <Text style={[styles.manualBtnText, { color: colors.text }]}>
          장소 직접 추가
        </Text>
      </Pressable>
    </View>
  );
}

const TOUCH_MIN = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  backHit: {
    minHeight: TOUCH_MIN,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: space.xs,
  },
  back: { fontSize: 15, fontWeight: "700" },
  title: { ...type.title, marginBottom: 4 },
  sub: { ...type.caption, marginBottom: space.lg },
  sectionLabel: { ...type.label, marginBottom: space.sm },
  hint: { ...type.caption, marginBottom: space.sm },
  insertRow: { flexDirection: "row", gap: 6 },
  insertBtn: {
    flex: 1,
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  insertText: { fontSize: 12, fontWeight: "800" },
  manualBtn: {
    paddingVertical: 14,
    minHeight: TOUCH_MIN,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  manualBtnText: { fontSize: 14, fontWeight: "800" },
});
