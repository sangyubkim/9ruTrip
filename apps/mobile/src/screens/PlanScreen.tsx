import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { rerouteTrip } from "../api/trip";
import { NextActionBanner } from "../components/NextActionBanner";
import { useGuideAlarms } from "../hooks/useGuideAlarms";
import type { ItineraryPlace, Trip } from "../types";
import { CATEGORY_LABEL, formatYen } from "../utils/cost";
import { formatTravelGlance, getNextAction } from "../utils/nextAction";

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
  const [rerouting, setRerouting] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);

  useGuideAlarms(trip, trip.guideAlarmsEnabled && trip.status === "active");

  const nextAction = useMemo(
    () => (trip.status === "active" ? getNextAction(trip) : null),
    [trip],
  );

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

  const toggle = (key: "aiRerouteEnabled" | "guideAlarmsEnabled") => {
    onChangeTrip({
      ...trip,
      [key]: !trip[key],
      updatedAt: new Date().toISOString(),
    });
  };

  const markDone = (placeId: string) => {
    const ids = new Set(trip.completedPlaceIds ?? []);
    ids.add(placeId);
    onChangeTrip({
      ...trip,
      completedPlaceIds: [...ids],
      updatedAt: new Date().toISOString(),
    });
  };

  const runReroute = async (reason: string) => {
    if (!trip.aiRerouteEnabled) {
      Alert.alert("AI 재루트 OFF", "아래에서 AI 재루트를 켠 뒤 다시 시도하세요.");
      return;
    }
    setRerouting(true);
    try {
      const res = await rerouteTrip({
        trip,
        dayIndex: day,
        reason,
        completedPlaceIds: trip.completedPlaceIds ?? [],
      });
      onChangeTrip({
        ...trip,
        places: res.places,
        plannedBudget: res.plannedBudget,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert(
        "재루트 완료",
        `${res.summary}\n엔진: ${res.engine} · 교체 ${res.replacedCount}곳`,
      );
    } catch (e) {
      Alert.alert(
        "재루트 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setRerouting(false);
    }
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<ItineraryPlace>) => {
    const done = (trip.completedPlaceIds ?? []).includes(item.id);
    const travel = formatTravelGlance(item);
    return (
      <ScaleDecorator>
        <View>
          {travel ? <Text style={styles.travel}>{travel}</Text> : null}
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            style={[
              styles.row,
              isActive && styles.rowActive,
              done && styles.rowDone,
            ]}
          >
            <Text style={styles.drag}>≡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.plannedTime ? `${item.plannedTime} · ` : ""}
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {CATEGORY_LABEL[item.category] || item.category} ·{" "}
                {formatYen(item.estimatedCost)}
                {item.category === "hotel" && item.lodgingScore
                  ? ` · 숙소점수 ${item.lodgingScore}`
                  : ""}
                {item.notes ? ` · ${item.notes}` : ""}
              </Text>
            </View>
            {trip.status === "active" ? (
              <Pressable
                onPress={() => markDone(item.id)}
                style={styles.doneBtn}
              >
                <Text style={styles.doneText}>{done ? "✓" : "완료"}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  };

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

      {!bannerHidden && trip.status === "active" ? (
        <NextActionBanner
          next={nextAction}
          onMarkDone={
            nextAction ? () => markDone(nextAction.place.id) : undefined
          }
          onDismiss={() => setBannerHidden(true)}
        />
      ) : null}

      <View style={styles.toggles}>
        <Pressable
          style={[styles.toggle, trip.guideAlarmsEnabled && styles.toggleOn]}
          onPress={() => toggle("guideAlarmsEnabled")}
        >
          <Text
            style={[
              styles.toggleText,
              trip.guideAlarmsEnabled && styles.toggleTextOn,
            ]}
          >
            가이드알람 {trip.guideAlarmsEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, trip.aiRerouteEnabled && styles.toggleOn]}
          onPress={() => toggle("aiRerouteEnabled")}
        >
          <Text
            style={[
              styles.toggleText,
              trip.aiRerouteEnabled && styles.toggleTextOn,
            ]}
          >
            AI재루트 {trip.aiRerouteEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
      </View>

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
        <Pressable
          style={[styles.btnAlt, rerouting && { opacity: 0.6 }]}
          disabled={rerouting}
          onPress={() =>
            void runReroute("사용자가 동선에서 벗어남 / 남은 일정 재조정")
          }
        >
          {rerouting ? (
            <ActivityIndicator color="#075985" />
          ) : (
            <Text style={styles.btnAltText}>이탈·재루트</Text>
          )}
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
  toggles: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
  },
  toggleOn: { backgroundColor: "#0c4a6e" },
  toggleText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  toggleTextOn: { color: "#fff" },
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
  travel: {
    fontSize: 11,
    color: "#0369a1",
    marginBottom: 4,
    marginLeft: 8,
    fontWeight: "600",
  },
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
  rowDone: { opacity: 0.55 },
  drag: { fontSize: 18, color: "#94a3b8", marginRight: 10, width: 20 },
  name: { fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, fontSize: 12, color: "#64748b" },
  doneBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
  },
  doneText: { color: "#047857", fontWeight: "700", fontSize: 12 },
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
