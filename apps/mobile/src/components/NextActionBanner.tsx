import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import type { NextAction } from "../utils/nextAction";

type Props = {
  next: NextAction | null;
  /** 현장 모드: 큰 패널 + 한손 조작 CTA */
  fieldMode?: boolean;
  onDismiss?: () => void;
  onMarkDone?: () => void;
  onNavigate?: () => void;
  onReroute?: () => void;
  rerouting?: boolean;
};

export function NextActionBanner({
  next,
  fieldMode,
  onDismiss,
  onMarkDone,
  onNavigate,
  onReroute,
  rerouting,
}: Props) {
  const { colors, isDark } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const triggerKey = next?.place.id ?? (fieldMode ? "idle" : "none");

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [triggerKey, reduce, opacity]);

  const idleBg = isDark ? colors.accentMuted : "#e0f2fe";
  const dueBg = isDark ? "#422006" : "#fef3c7";
  const overdueBg = isDark ? "#450a0a" : "#fee2e2";
  const dueBorder = isDark ? "#fbbf24" : "#d97706";
  const overdueBorder = isDark ? "#f87171" : "#b91c1c";

  if (!next) {
    if (!fieldMode) return null;
    return (
      <Animated.View
        style={[
          styles.field,
          {
            opacity,
            backgroundColor: idleBg,
            borderColor: colors.primary,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel="다음 액션 없음"
      >
        <Text style={[styles.kicker, { color: colors.accent }]}>
          현장 · 다음 액션
        </Text>
        <Text style={[styles.fieldTitle, { color: colors.text }]}>
          남은 일정이 없습니다
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          모든 장소를 완료했거나 일정이 비어 있습니다. 「목록 보기」에서 장소를
          추가해 보세요.
        </Text>
        {onDismiss ? (
          <Pressable
            style={styles.listLink}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="전체 일정 보기"
          >
            <Text style={[styles.listLinkText, { color: colors.accent }]}>
              전체 일정 보기
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  const timing =
    next.minutesUntil == null
      ? next.place.plannedTime
        ? `예정 ${next.place.plannedTime}`
        : "다음 일정"
      : next.minutesUntil >= 0
        ? `${next.minutesUntil}분 후`
        : `${Math.abs(next.minutesUntil)}분 지남`;

  const toneStyle = next.isOverdue
    ? { backgroundColor: overdueBg, borderColor: overdueBorder }
    : next.isDue
      ? { backgroundColor: dueBg, borderColor: dueBorder }
      : { backgroundColor: idleBg, borderColor: colors.mapBorder };

  const timingChipBg = next.isOverdue
    ? isDark
      ? "#7f1d1d"
      : "#fecaca"
    : next.isDue
      ? isDark
        ? "#78350f"
        : "#fde68a"
      : isDark
        ? colors.bgElevated
        : "#ffffff";
  const timingChipFg = next.isOverdue
    ? isDark
      ? "#fecaca"
      : "#991b1b"
    : next.isDue
      ? isDark
        ? "#fde68a"
        : "#92400e"
      : colors.textSecondary;

  if (fieldMode) {
    return (
      <Animated.View
        style={[styles.field, toneStyle, { opacity }]}
        accessibilityRole="summary"
        accessibilityLabel={`다음으로 갈 곳 ${next.place.name}`}
      >
        <View style={styles.fieldTop}>
          <Text style={[styles.kicker, { color: colors.accent }]}>
            다음으로 갈 곳 · {next.dayLabel}
          </Text>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.dismissHit}
              accessibilityRole="button"
              accessibilityLabel="목록 보기"
            >
              <Text style={[styles.x, { color: colors.accent }]}>목록 보기</Text>
            </Pressable>
          ) : null}
        </View>
        <View
          style={[styles.timingChip, { backgroundColor: timingChipBg }]}
          accessibilityRole="text"
        >
          <Text style={[styles.timingChipText, { color: timingChipFg }]}>
            {timing}
          </Text>
        </View>
        <Text
          style={[styles.fieldTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {next.place.name}
        </Text>
        {next.place.notes ? (
          <Text
            style={[styles.fieldMeta, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {next.place.notes}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          {onNavigate ? (
            <Pressable
              style={[styles.ctaPrimary, { backgroundColor: colors.primary }]}
              onPress={onNavigate}
              accessibilityRole="button"
              accessibilityLabel="길안내"
            >
              <Text
                style={[styles.ctaPrimaryText, { color: colors.primaryFg }]}
              >
                길안내
              </Text>
            </Pressable>
          ) : null}
          {onMarkDone ? (
            <Pressable
              style={[
                styles.ctaPrimaryDone,
                { backgroundColor: colors.success },
              ]}
              onPress={onMarkDone}
              accessibilityRole="button"
              accessibilityLabel="완료"
            >
              <Text style={[styles.ctaPrimaryText, { color: "#fff" }]}>
                완료
              </Text>
            </Pressable>
          ) : null}
        </View>
        {onReroute ? (
          <Pressable
            style={[
              styles.ctaGhost,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.mapBorder,
                opacity: rerouting ? 0.55 : 1,
              },
            ]}
            disabled={rerouting}
            onPress={onReroute}
            accessibilityRole="button"
            accessibilityLabel="일정 재루트"
          >
            <Text style={[styles.ctaGhostText, { color: colors.accent }]}>
              {rerouting ? "재루트 중…" : "일정 재루트"}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.banner, toneStyle, { opacity }]}
      accessibilityRole="summary"
      accessibilityLabel={`다음 액션 ${next.place.name}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: colors.accent }]}>
          다음 액션 · {next.dayLabel}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {next.place.name}
        </Text>
        <View
          style={[
            styles.timingChipCompact,
            { backgroundColor: timingChipBg },
          ]}
        >
          <Text style={[styles.timingChipTextCompact, { color: timingChipFg }]}>
            {timing}
            {next.place.notes ? ` · ${next.place.notes}` : ""}
          </Text>
        </View>
      </View>
      {onMarkDone ? (
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onMarkDone}
          accessibilityRole="button"
          accessibilityLabel="완료"
        >
          <Text style={[styles.btnText, { color: colors.primaryFg }]}>
            완료
          </Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismissHit}
          accessibilityRole="button"
          accessibilityLabel="현장 모드"
        >
          <Text style={[styles.xCompact, { color: colors.accent }]}>현장</Text>
        </Pressable>
      ) : null}
    </Animated.View>
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
  field: {
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    minHeight: 188,
    borderWidth: 2,
  },
  fieldTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: { fontSize: 13, fontWeight: "800" },
  title: { marginTop: 2, fontWeight: "800", fontSize: 15 },
  fieldTitle: {
    marginTop: space.sm,
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  meta: { marginTop: space.sm, fontSize: 13, lineHeight: 19 },
  fieldMeta: {
    marginTop: space.sm,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  timingChip: {
    alignSelf: "flex-start",
    marginTop: space.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  timingChipText: { fontSize: 13, fontWeight: "900" },
  timingChipCompact: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: "100%",
  },
  timingChipTextCompact: { fontSize: 12, fontWeight: "700" },
  ctaRow: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.lg,
  },
  ctaPrimary: {
    flex: 1,
    paddingVertical: 16,
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryDone: {
    flex: 1,
    paddingVertical: 16,
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryText: { fontWeight: "900", fontSize: 17 },
  ctaGhost: {
    marginTop: space.md,
    borderWidth: 1,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaGhostText: { fontWeight: "700", fontSize: 14 },
  listLink: {
    marginTop: space.md,
    alignSelf: "flex-start",
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  listLinkText: { fontWeight: "800", fontSize: 15 },
  btn: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 44,
    borderRadius: radius.sm,
    justifyContent: "center",
  },
  btnText: { fontWeight: "800", fontSize: 14 },
  dismissHit: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  x: { fontSize: 13, fontWeight: "800" },
  xCompact: { fontSize: 13, fontWeight: "800", paddingHorizontal: 4 },
});
