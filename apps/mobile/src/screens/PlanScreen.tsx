import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import {
  compareTransport,
  enrichTransport,
  rerouteTrip,
  suggestPlaces,
} from "../api/trip";
import { DeviationBanner } from "../components/DeviationBanner";
import { NextActionBanner } from "../components/NextActionBanner";
import { PlanDayMap } from "../components/PlanDayMap";
import { TransportCompareSheet } from "../components/TransportCompareSheet";
import { useGpsDeviation } from "../hooks/useGpsDeviation";
import { useGuideAlarms } from "../hooks/useGuideAlarms";
import type {
  ItineraryPlace,
  LodgingCandidate,
  PlaceCategory,
  TransportMode,
  TransportOption,
  Trip,
} from "../types";
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

type CatFilter = "all" | "food" | "attraction" | "hotel";

const FILTERS: { id: CatFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "food", label: "맛집" },
  { id: "attraction", label: "관광" },
  { id: "hotel", label: "숙소" },
];

const MAP_PANE_HEIGHT = Math.round(Dimensions.get("window").height * 0.37);

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
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [rerouting, setRerouting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [comparePlace, setComparePlace] = useState<ItineraryPlace | null>(null);
  const [compareOptions, setCompareOptions] = useState<TransportOption[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareEngine, setCompareEngine] = useState<string>("");

  useGuideAlarms(trip, trip.guideAlarmsEnabled && trip.status === "active");

  const gpsDev = useGpsDeviation(
    trip,
    trip.status === "active" && trip.aiRerouteEnabled,
  );

  const nextAction = useMemo(
    () => (trip.status === "active" ? getNextAction(trip) : null),
    [trip],
  );

  const dayPlaces = useMemo(() => {
    let list = trip.places
      .filter((p) => p.dayIndex === day)
      .sort((a, b) => a.order - b.order);
    if (catFilter !== "all") {
      list = list.filter((p) => p.category === catFilter);
    }
    return list;
  }, [trip.places, day, catFilter]);

  const mapPlaces = useMemo(
    () =>
      trip.places
        .filter((p) => p.dayIndex === day)
        .sort((a, b) => a.order - b.order),
    [trip.places, day],
  );

  const lodgingCandidates: LodgingCandidate[] = trip.lodgingCandidates ?? [];

  const applyPlaces = async (
    places: ItineraryPlace[],
    extra: Partial<Trip> = {},
  ) => {
    setEnriching(true);
    try {
      const res = await enrichTransport(places, true, trip.cityId);
      onChangeTrip({
        ...trip,
        ...extra,
        places: res.places,
        plannedBudget: res.places.reduce(
          (s, p) => s + (Number(p.estimatedCost) || 0),
          0,
        ),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      onChangeTrip({
        ...trip,
        ...extra,
        places,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setEnriching(false);
    }
  };

  const reorder = (data: ItineraryPlace[]) => {
    if (catFilter !== "all") {
      Alert.alert(
        "필터 해제",
        "카테고리 필터가 켜져 있으면 전체 Day 순서를 바꿀 수 없습니다. 전체를 선택한 뒤 드래그하세요.",
      );
      return;
    }
    const others = trip.places.filter((p) => p.dayIndex !== day);
    const reordered = data.map((p, i) => ({ ...p, order: i, dayIndex: day }));
    const merged = [...others, ...reordered].sort(
      (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
    );
    merged.forEach((p, i) => {
      p.order = i;
    });
    void applyPlaces(merged);
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

  const pickLodging = (cand: LodgingCandidate) => {
    const withoutHotel = trip.places.filter((p) => p.category !== "hotel");
    const hotelPlace: ItineraryPlace = {
      id: cand.id,
      name: cand.name,
      category: "hotel",
      lat: cand.lat,
      lng: cand.lng,
      estimatedCost: cand.estimatedCost,
      notes: cand.notes,
      dayIndex: 0,
      order: 0,
      lodgingScore: cand.lodgingScore,
      scoreBreakdown: cand.scoreBreakdown,
    };
    const merged = [hotelPlace, ...withoutHotel].map((p, i) => ({
      ...p,
      order: i,
    }));
    void applyPlaces(merged, { preferredLodgingId: cand.id });
    Alert.alert(
      "숙소 선택",
      `${cand.name}\n점수 ${cand.lodgingScore} (허브 ${cand.scoreBreakdown.centrality} · 가격 ${cand.scoreBreakdown.priceEstimate} · 평점프록시 ${cand.scoreBreakdown.ratingProxy})`,
    );
  };

  const insertSuggested = async (category: PlaceCategory) => {
    setSuggesting(true);
    try {
      const res = await suggestPlaces({
        cityId: trip.cityId,
        category,
        partySize: trip.partySize,
      });
      const pick = res.places[0];
      if (!pick) {
        Alert.alert("제안 없음", "이 카테고리 제안이 없습니다.");
        return;
      }
      const dayList = trip.places.filter((p) => p.dayIndex === day);
      const maxOrder = dayList.reduce((m, p) => Math.max(m, p.order), -1);
      const neu: ItineraryPlace = {
        ...pick,
        id: `place-${Date.now()}`,
        dayIndex: day,
        order: maxOrder + 1,
      };
      const merged = [...trip.places, neu].sort(
        (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
      );
      merged.forEach((p, i) => {
        p.order = i;
      });
      await applyPlaces(merged);
      Alert.alert("장소 추가", `${neu.name} (Day ${day + 1})`);
    } catch (e) {
      Alert.alert(
        "제안 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setSuggesting(false);
    }
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

  const openTransportCompare = async (place: ItineraryPlace) => {
    setSelectedPlaceId(place.id);
    setComparePlace(place);
    setCompareLoading(true);
    setCompareEngine("");
    const cached = place.transportOptions;
    if (cached && cached.length >= 3) {
      setCompareOptions(cached);
      setCompareLoading(false);
      return;
    }
    try {
      const res = await compareTransport({
        places: trip.places,
        placeId: place.id,
      });
      setCompareOptions(res.options ?? []);
      setCompareEngine(
        res.googleMapsConfigured
          ? `엔진: ${res.engine}`
          : `엔진: ${res.engine} (Maps 키 없음 · 추정)`,
      );
    } catch (e) {
      setCompareOptions(place.transportOptions ?? []);
      Alert.alert(
        "비교 실패",
        e instanceof Error ? e.message : "교통 비교를 불러오지 못했습니다.",
      );
      setComparePlace(null);
    } finally {
      setCompareLoading(false);
    }
  };

  const applyTransportMode = (mode: TransportMode) => {
    if (!comparePlace) return;
    const opt = compareOptions.find((o) => o.mode === mode);
    if (!opt) return;
    const places = trip.places.map((p) =>
      p.id === comparePlace.id
        ? {
            ...p,
            preferredTransportMode: mode,
            transportOptions: compareOptions,
            travelFromPrevMinutes: opt.minutes,
            travelFromPrevCost: opt.estimatedCost,
            transportEngine: opt.engine,
          }
        : p,
    );
    onChangeTrip({
      ...trip,
      places,
      updatedAt: new Date().toISOString(),
    });
    setComparePlace(null);
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<ItineraryPlace>) => {
    const done = (trip.completedPlaceIds ?? []).includes(item.id);
    const travel = formatTravelGlance(item);
    const selected = selectedPlaceId === item.id;
    return (
      <ScaleDecorator>
        <View>
          {travel ? (
            <Pressable onPress={() => void openTransportCompare(item)}>
              <Text style={styles.travel}>{travel}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSelectedPlaceId(item.id)}
            onLongPress={catFilter === "all" ? drag : undefined}
            delayLongPress={150}
            style={[
              styles.row,
              isActive && styles.rowActive,
              selected && styles.rowSelected,
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

  const listHeader = (
    <View>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 목록</Text>
      </Pressable>
      <Text style={styles.title}>
        {trip.cityName} {trip.nights}박 {trip.days}일
      </Text>
      <Text style={styles.sub}>
        {trip.partySize}명 · 계획 {formatYen(trip.plannedBudget)} · {trip.status}
        {enriching ? " · 교통 재계산…" : ""}
      </Text>
      <Text style={styles.tip}>
        이동 glance를 탭하면 도보/대중교통/택시를 비교합니다. 길게 눌러
        드래그(필터=전체).
      </Text>

      {!bannerHidden && trip.status === "active" ? (
        <NextActionBanner
          next={nextAction}
          onMarkDone={
            nextAction ? () => markDone(nextAction.place.id) : undefined
          }
          onDismiss={() => setBannerHidden(true)}
        />
      ) : null}

      {gpsDev.showBanner ? (
        <DeviationBanner
          distanceKm={gpsDev.distanceKm}
          busy={rerouting}
          onDismiss={gpsDev.dismiss}
          onReroute={() => {
            gpsDev.dismiss();
            void runReroute(
              "GPS 이탈: 다음 장소에서 멀리 떨어짐 — 남은 일정 재조정",
            );
          }}
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
            onPress={() => {
              setDay(d);
              setSelectedPlaceId(null);
            }}
          >
            <Text style={[styles.tabText, day === d && styles.tabTextOn]}>
              Day {d + 1}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.mapPane}>
        <PlanDayMap
          cityId={trip.cityId}
          places={mapPlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
        />
      </View>

      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.chip, catFilter === f.id && styles.chipOn]}
            onPress={() => setCatFilter(f.id)}
          >
            <Text
              style={[styles.chipText, catFilter === f.id && styles.chipTextOn]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.insertRow}>
        {(["food", "attraction", "hotel"] as PlaceCategory[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.insertBtn, suggesting && { opacity: 0.6 }]}
            disabled={suggesting}
            onPress={() => void insertSuggested(c)}
          >
            <Text style={styles.insertText}>
              +{CATEGORY_LABEL[c] || c} 추가
            </Text>
          </Pressable>
        ))}
      </View>

      {lodgingCandidates.length > 0 ? (
        <View style={styles.lodgingBox}>
          <Text style={styles.lodgingTitle}>숙소 후보 (점수 분해)</Text>
          {lodgingCandidates.map((c) => {
            const selected = trip.preferredLodgingId === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.lodgingRow, selected && styles.lodgingOn]}
                onPress={() => pickLodging(c)}
              >
                <Text style={styles.lodgingName}>
                  {selected ? "✓ " : ""}
                  {c.name} · {c.lodgingScore}점
                </Text>
                <Text style={styles.lodgingMeta}>
                  허브 {c.scoreBreakdown.centrality} · 가격{" "}
                  {c.scoreBreakdown.priceEstimate} · 평점프록시{" "}
                  {c.scoreBreakdown.ratingProxy} · {formatYen(c.estimatedCost)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <DraggableFlatList
        data={dayPlaces}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => reorder(data)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>이 날 일정이 없습니다.</Text>
        }
      />

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={onMap}>
          <Text style={styles.btnText}>전체지도</Text>
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

      <TransportCompareSheet
        visible={comparePlace != null}
        placeName={comparePlace?.name ?? ""}
        options={compareOptions}
        selectedMode={comparePlace?.preferredTransportMode}
        loading={compareLoading}
        engineHint={compareEngine}
        onSelect={applyTransportMode}
        onClose={() => setComparePlace(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0c4a6e" },
  sub: { color: "#64748b", marginTop: 2 },
  tip: { marginTop: 8, marginBottom: 8, fontSize: 12, color: "#94a3b8" },
  mapPane: {
    height: MAP_PANE_HEIGHT,
    marginBottom: 10,
  },
  toggles: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e0f2fe",
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
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  chipOn: { backgroundColor: "#0c4a6e" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  insertRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  insertBtn: {
    flex: 1,
    backgroundColor: "#f0f9ff",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  insertText: { color: "#0369a1", fontSize: 11, fontWeight: "700" },
  lodgingBox: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fed7aa",
    maxHeight: 140,
  },
  lodgingTitle: {
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 6,
    fontSize: 12,
  },
  lodgingRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#fdba74",
  },
  lodgingOn: { backgroundColor: "#ffedd5" },
  lodgingName: { fontWeight: "700", color: "#7c2d12", fontSize: 12 },
  lodgingMeta: { fontSize: 10, color: "#c2410c", marginTop: 2 },
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
    borderColor: "#bae6fd",
  },
  rowActive: { backgroundColor: "#e0f2fe", borderColor: "#38bdf8" },
  rowSelected: { borderColor: "#0284c7", backgroundColor: "#f0f9ff" },
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
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnAlt: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnAltText: { color: "#075985", fontWeight: "700", fontSize: 13 },
});
