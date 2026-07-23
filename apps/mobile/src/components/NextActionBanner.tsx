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
        <Text style={styles.meta}>
          모든 장소를 완료했거나 일정이 비어 있습니다. 「목록 보기」에서 장소를
          추가해 보세요.
        </Text>
        {onDismiss ? (
          <Pressable style={styles.listLink} onPress={onDismiss}>
            <Text style={styles.listLinkText}>전체 일정 보기</Text>
          </Pressable>
        ) : null}
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
          <Text style={styles.kicker}>다음으로 갈 곳 · {next.dayLabel}</Text>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.dismissHit}
            >
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
            <Pressable style={styles.ctaPrimaryDone} onPress={onMarkDone}>
              <Text style={styles.ctaPrimaryText}>완료</Text>
            </Pressable>
          ) : null}
        </View>
        {onReroute ? (
          <Pressable
            style={[styles.ctaGhost, rerouting && { opacity: 0.55 }]}
            disabled={rerouting}
            onPress={onReroute}
          >
            <Text style={styles.ctaGhostText}>
              {rerouting ? "재루트 중…" : "일정 재루트"}
            </Text>
          </Pressable>
        ) : null}
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
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissHit}>
          <Text style={styles.xCompact}>현장</Text>
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
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  field: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    minHeight: 168,
    borderWidth: 2,
    borderColor: "#0c4a6e",
  },
  idle: { backgroundColor: "#e0f2fe" },
  due: { backgroundColor: "#fef3c7", borderColor: "#d97706" },
  overdue: { backgroundColor: "#fee2e2", borderColor: "#b91c1c" },
  fieldTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: { fontSize: 13, fontWeight: "800", color: "#0369a1" },
  title: { marginTop: 2, fontWeight: "800", color: "#0f172a", fontSize: 15 },
  fieldTitle: {
    marginTop: 10,
    fontWeight: "900",
    color: "#0c4a6e",
    fontSize: 28,
    lineHeight: 34,
  },
  meta: { marginTop: 2, fontSize: 12, color: "#475569" },
  fieldMeta: {
    marginTop: 8,
    fontSize: 15,
    color: "#334155",
    fontWeight: "700",
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: "#0c4a6e",
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryDone: {
    flex: 1,
    backgroundColor: "#0369a1",
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  ctaGhost: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#7dd3fc",
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaGhostText: { color: "#075985", fontWeight: "700", fontSize: 14 },
  listLink: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  listLinkText: { color: "#0369a1", fontWeight: "800", fontSize: 15 },
  btn: {
    backgroundColor: "#0c4a6e",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 10,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  dismissHit: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  x: { color: "#0369a1", fontSize: 13, fontWeight: "800" },
  xCompact: { color: "#0369a1", fontSize: 13, fontWeight: "800", paddingHorizontal: 4 },
});
