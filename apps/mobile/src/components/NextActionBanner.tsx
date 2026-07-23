import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NextAction } from "../utils/nextAction";

type Props = {
  next: NextAction | null;
  onDismiss?: () => void;
  onMarkDone?: () => void;
};

export function NextActionBanner({ next, onDismiss, onMarkDone }: Props) {
  if (!next) return null;

  const timing =
    next.minutesUntil == null
      ? next.place.plannedTime
        ? `예정 ${next.place.plannedTime}`
        : "다음 일정"
      : next.minutesUntil >= 0
        ? `${next.minutesUntil}분 후`
        : `${Math.abs(next.minutesUntil)}분 지남`;

  return (
    <View
      style={[
        styles.banner,
        next.isOverdue ? styles.overdue : next.isDue ? styles.due : styles.idle,
      ]}
    >
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
          <Text style={styles.x}>✕</Text>
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
  idle: { backgroundColor: "#e0f2fe" },
  due: { backgroundColor: "#fef3c7" },
  overdue: { backgroundColor: "#fee2e2" },
  kicker: { fontSize: 11, fontWeight: "700", color: "#0369a1" },
  title: { marginTop: 2, fontWeight: "800", color: "#0f172a", fontSize: 15 },
  meta: { marginTop: 2, fontSize: 12, color: "#475569" },
  btn: {
    backgroundColor: "#0c4a6e",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  x: { color: "#64748b", fontSize: 16, paddingHorizontal: 4 },
});
