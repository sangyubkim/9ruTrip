import { Pressable, StyleSheet, Text, View } from "react-native";
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
  if (!next) {
    if (!fieldMode) return null;
    return (
      <View style={[styles.field, styles.idle]}>
        <Text style={styles.kicker}>현장 · 다음 액션</Text>
        <Text style={styles.fieldTitle}>남은 일정이 없습니다</Text>
        <Text style={styles.meta}>모든 장소를 완료했거나 일정이 비어 있습니다.</Text>
      </View>
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

  const tone = next.isOverdue
    ? styles.overdue
    : next.isDue
      ? styles.due
      : styles.idle;

  if (fieldMode) {
    return (
      <View style={[styles.field, tone]}>
        <View style={styles.fieldTop}>
          <Text style={styles.kicker}>현장 · {next.dayLabel}</Text>
          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={10}>
              <Text style={styles.x}>목록 보기</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.fieldTitle} numberOfLines={2}>
          {next.place.name}
        </Text>
        <Text style={styles.fieldMeta}>
          {timing}
          {next.place.notes ? ` · ${next.place.notes}` : ""}
        </Text>
        <View style={styles.ctaRow}>
          {onNavigate ? (
            <Pressable style={styles.ctaPrimary} onPress={onNavigate}>
              <Text style={styles.ctaPrimaryText}>길안내</Text>
            </Pressable>
          ) : null}
          {onMarkDone ? (
            <Pressable style={styles.ctaSecondary} onPress={onMarkDone}>
              <Text style={styles.ctaSecondaryText}>완료</Text>
            </Pressable>
          ) : null}
          {onReroute ? (
            <Pressable
              style={[styles.ctaGhost, rerouting && { opacity: 0.55 }]}
              disabled={rerouting}
              onPress={onReroute}
            >
              <Text style={styles.ctaGhostText}>
                {rerouting ? "재루트…" : "재루트"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, tone]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>다음 액션 · {next.dayLabel}</Text>
        <Text style={styles.title}>{next.place.name}</Text>
        <Text style={styles.meta}>
          {timing}
          {next.place.notes ? ` · ${next.place.notes}` : ""}
        </Text>
      </View>
      {onMarkDone ? (
        <Pressable style={styles.btn} onPress={onMarkDone}>
          <Text style={styles.btnText}>완료</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.xCompact}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  field: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    minHeight: 140,
  },
  idle: { backgroundColor: "#e0f2fe" },
  due: { backgroundColor: "#fef3c7" },
  overdue: { backgroundColor: "#fee2e2" },
  fieldTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: { fontSize: 12, fontWeight: "800", color: "#0369a1" },
  title: { marginTop: 2, fontWeight: "800", color: "#0f172a", fontSize: 15 },
  fieldTitle: {
    marginTop: 8,
    fontWeight: "900",
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 32,
  },
  meta: { marginTop: 2, fontSize: 12, color: "#475569" },
  fieldMeta: { marginTop: 6, fontSize: 14, color: "#334155", fontWeight: "600" },
  ctaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  ctaPrimary: {
    flex: 1.2,
    backgroundColor: "#0c4a6e",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  ctaSecondary: {
    flex: 1,
    backgroundColor: "#0369a1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaSecondaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ctaGhost: {
    flex: 0.9,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#7dd3fc",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaGhostText: { color: "#075985", fontWeight: "800", fontSize: 14 },
  btn: {
    backgroundColor: "#0c4a6e",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  x: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
  xCompact: { color: "#64748b", fontSize: 16, paddingHorizontal: 4 },
});
