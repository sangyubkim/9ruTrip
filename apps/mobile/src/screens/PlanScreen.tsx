import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import type { ItineraryPlace, Trip } from "../types";
import { CATEGORY_LABEL, formatYen } from "../utils/cost";

type Props = {
  trip: Trip;
  onChangeTrip: (trip: Trip) => void;
  onBack: () => void;
  onMap: () => void;
  onCapture: () => void;
  onExpenses: () => void;
  onSummary: () => void;
};

export function PlanScreen({
  trip,
  onChangeTrip,
  onBack,
  onMap,
  onCapture,
  onExpenses,
  onSummary,
}: Props) {
  const days = useMemo(() => {
    const set = new Set(trip.places.map((p) => p.dayIndex));
    const max = Math.max(trip.days - 1, ...Array.from(set), 0);
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [trip.places, trip.days]);

  const [day, setDay] = useState(0);

  const dayPlaces = useMemo(
    () =>
      trip.places
        .filter((p) => p.dayIndex === day)
        .sort((a, b) => a.order - b.order),
    [trip.places, day],
  );

  const reorder = (data: ItineraryPlace[]) => {
    const others = trip.places.filter((p) => p.dayIndex !== day);
    const reordered = data.map((p, i) => ({ ...p, order: i, dayIndex: day }));
    const merged = [...others, ...reordered].sort(
      (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
    );
    merged.forEach((p, i) => {
      p.order = i;
    });
    onChangeTrip({
      ...trip,
      places: merged,
      updatedAt: new Date().toISOString(),
    });
  };

  const setStatus = (status: Trip["status"]) => {
    onChangeTrip({ ...trip, status, updatedAt: new Date().toISOString() });
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<ItineraryPlace>) => (
    <ScaleDecorator>
      <Pressable
        onLongPress={drag}
        delayLongPress={150}
        style={[styles.row, isActive && styles.rowActive]}
      >
        <Text style={styles.drag}>≡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {CATEGORY_LABEL[item.category] || item.category} · {formatYen(item.estimatedCost)}
            {item.notes ? ` · ${item.notes}` : ""}
          </Text>
        </View>
      </Pressable>
    </ScaleDecorator>
  );

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 목록</Text>
      </Pressable>
      <Text style={styles.title}>
        {trip.cityName} {trip.nights}박 {trip.days}일
      </Text>
      <Text style={styles.sub}>
        {trip.partySize}명 · 계획 {formatYen(trip.plannedBudget)} · {trip.status}
      </Text>
      <Text style={styles.tip}>길게 눌러 드래그하면 순서를 바꿀 수 있습니다.</Text>

      <View style={styles.tabs}>
        {days.map((d) => (
          <Pressable
            key={d}
            style={[styles.tab, day === d && styles.tabOn]}
            onPress={() => setDay(d)}
          >
            <Text style={[styles.tabText, day === d && styles.tabTextOn]}>
              Day {d + 1}
            </Text>
          </Pressable>
        ))}
      </View>

      <DraggableFlatList
        data={dayPlaces}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => reorder(data)}
        renderItem={renderItem}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>이 날 일정이 없습니다.</Text>
        }
      />

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={onMap}>
          <Text style={styles.btnText}>지도</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onCapture}>
          <Text style={styles.btnText}>리뷰</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onExpenses}>
          <Text style={styles.btnText}>경비</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onSummary}>
          <Text style={styles.btnText}>요약</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.btnAlt} onPress={() => setStatus("active")}>
          <Text style={styles.btnAltText}>여행 시작</Text>
        </Pressable>
        <Pressable style={styles.btnAlt} onPress={() => setStatus("done")}>
          <Text style={styles.btnAltText}>여행 종료</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { color: "#64748b", marginTop: 2 },
  tip: { marginTop: 8, marginBottom: 8, fontSize: 12, color: "#94a3b8" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  tabOn: { backgroundColor: "#0369a1" },
  tabText: { color: "#334155", fontWeight: "600" },
  tabTextOn: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowActive: { backgroundColor: "#e0f2fe", borderColor: "#38bdf8" },
  drag: { fontSize: 18, color: "#94a3b8", marginRight: 10, width: 20 },
  name: { fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, fontSize: 12, color: "#64748b" },
  empty: { color: "#94a3b8", padding: 16 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#0c4a6e",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnAlt: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnAltText: { color: "#075985", fontWeight: "700", fontSize: 13 },
});
