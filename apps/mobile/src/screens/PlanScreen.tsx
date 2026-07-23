import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import {
  compareTransport,
  enrichTransport,
  optimizeDay,
  rerouteTrip,
  suggestPlaces,
} from "../api/trip";
import { ChecklistSection } from "../components/ChecklistSection";
import { DeviationBanner } from "../components/DeviationBanner";
import { NextActionBanner } from "../components/NextActionBanner";
import { PlaceSuggestModal } from "../components/PlaceSuggestModal";
import { PlannedTimeModal } from "../components/PlannedTimeModal";
import { PlanDayMap } from "../components/PlanDayMap";
import { TransportCompareSheet } from "../components/TransportCompareSheet";
import { WeatherCrowdChip } from "../components/WeatherCrowdChip";
import { useGpsDeviation } from "../hooks/useGpsDeviation";
import { useGuideAlarms } from "../hooks/useGuideAlarms";
import {
  buildCityLegs,
  CITIES,
  cityIdForDay,
  createDefaultChecklist,
  tripCitiesLabel,
  type ItineraryPlace,
  type LodgingCandidate,
  type MvpCityId,
  type PlaceCategory,
  type TransportMode,
  type TransportOption,
  type Trip,
} from "../types";
import { useTheme } from "../theme/ThemeContext";
import { CATEGORY_LABEL, formatYen, STATUS_LABEL } from "../utils/cost";
import { formatLodgingScoreLines } from "../utils/lodgingExplain";
import { openMapsDirections } from "../utils/mapsNavigation";
import { formatTravelGlance, getNextAction } from "../utils/nextAction";
import { summarizeRerouteChanges } from "../utils/reroutePreview";

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
type PlanViewMode = "field" | "list";

const FILTERS: { id: CatFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "food", label: "맛집" },
  { id: "attraction", label: "관광" },
  { id: "hotel", label: "숙소" },
];

const MAP_PANE_HEIGHT = Math.round(Dimensions.get("window").height * 0.37);
const UNDO_MS = 5000;
const UNDO_MAX = 5;
const HANDLE_HIT_SLOP = { top: 14, bottom: 14, left: 14, right: 14 };

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const TOUCH_MIN = 44;

function renumberGlobal(places: ItineraryPlace[]): ItineraryPlace[] {
  const sorted = [...places].sort(
    (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
  );
  return sorted.map((p, i) => ({ ...p, order: i }));
}

function budgetOf(places: ItineraryPlace[]): number {
  return places.reduce((s, p) => s + (Number(p.estimatedCost) || 0), 0);
}

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
  const [optimizing, setOptimizing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [viewMode, setViewMode] = useState<PlanViewMode>("list");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [comparePlace, setComparePlace] = useState<ItineraryPlace | null>(null);
  const [compareOptions, setCompareOptions] = useState<TransportOption[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareEngine, setCompareEngine] = useState<string>("");
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestCategory, setSuggestCategory] =
    useState<PlaceCategory>("food");
  const [suggestList, setSuggestList] = useState<ItineraryPlace[]>([]);
  const [suggestSource, setSuggestSource] = useState<string>("");
  const [timeEditPlace, setTimeEditPlace] = useState<ItineraryPlace | null>(
    null,
  );
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);

  const undoStackRef = useRef<ItineraryPlace[][]>([]);
  const inlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { colors } = useTheme();

  useGuideAlarms(trip, trip.guideAlarmsEnabled && trip.status === "active");

  const gpsDev = useGpsDeviation(
    trip,
    trip.status === "active" && trip.aiRerouteEnabled,
  );

  const nextAction = useMemo(
    () => (trip.status === "active" ? getNextAction(trip) : null),
    [trip],
  );

  const isFieldMode =
    trip.status === "active" && viewMode === "field" && !bannerHidden;

  const dayCityId = useMemo(() => cityIdForDay(trip, day), [trip, day]);
  const isMultiCity = (trip.cities?.length ?? 0) > 1;
  const checklist = trip.checklist?.length
    ? trip.checklist
    : createDefaultChecklist();
  const existingCityIds =
    trip.cities?.map((c) => c.cityId) ?? ([trip.cityId] as MvpCityId[]);
  const hasTokyo = existingCityIds.includes("tokyo");
  const hasOsaka = existingCityIds.includes("osaka");
  const secondaryCityToAdd: MvpCityId | null =
    hasTokyo && hasOsaka ? null : hasTokyo ? "osaka" : "tokyo";

  useEffect(() => {
    if (trip.status === "active") {
      setViewMode("field");
      setBannerHidden(false);
    } else {
      setViewMode("list");
    }
  }, [trip.status]);

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

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (inlineTimerRef.current) clearTimeout(inlineTimerRef.current);
    };
  }, []);

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const flashInline = (msg: string) => {
    setInlineMsg(msg);
    if (inlineTimerRef.current) clearTimeout(inlineTimerRef.current);
    inlineTimerRef.current = setTimeout(() => {
      setInlineMsg(null);
      inlineTimerRef.current = null;
    }, 3200);
  };

  const resetUndoTimer = () => {
    clearUndoTimer();
    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false);
      undoStackRef.current = [];
      setUndoDepth(0);
      undoTimerRef.current = null;
    }, UNDO_MS);
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [
      trip.places.map((p) => ({ ...p })),
      ...undoStackRef.current,
    ].slice(0, UNDO_MAX);
    setUndoDepth(undoStackRef.current.length);
    setUndoVisible(true);
    resetUndoTimer();
  };

  /** 로컬 순서를 즉시 반영한 뒤 enrich (낙관적 업데이트). */
  const applyPlaces = async (
    places: ItineraryPlace[],
    extra: Partial<Trip> = {},
  ) => {
    const localTrip: Trip = {
      ...trip,
      ...extra,
      places,
      plannedBudget: budgetOf(places),
      updatedAt: new Date().toISOString(),
    };
    onChangeTrip(localTrip);
    setEnriching(true);
    try {
      const res = await enrichTransport(places, true, trip.cityId);
      onChangeTrip({
        ...localTrip,
        places: res.places,
        plannedBudget: budgetOf(res.places),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // 로컬 순서·삭제는 이미 반영됨
    } finally {
      setEnriching(false);
    }
  };

  const undoLastChange = () => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const snap = stack[0];
    undoStackRef.current = stack.slice(1);
    const nextDepth = undoStackRef.current.length;
    setUndoDepth(nextDepth);
    if (nextDepth === 0) {
      setUndoVisible(false);
      clearUndoTimer();
    } else {
      resetUndoTimer();
    }
    void applyPlaces(snap);
  };

  /**
   * 필터 ON이어도 필터된 부분 집합만 재정렬한 뒤
   * 당일 전체 시퀀스에 splice (다른 카테고리 상대 위치 유지).
   */
  const reorder = (data: ItineraryPlace[]) => {
    pushUndoSnapshot();
    const others = trip.places.filter((p) => p.dayIndex !== day);
    const dayFull = trip.places
      .filter((p) => p.dayIndex === day)
      .sort((a, b) => a.order - b.order);

    let reorderedDay: ItineraryPlace[];
    if (catFilter === "all") {
      reorderedDay = data.map((p) => ({ ...p, dayIndex: day }));
    } else {
      const queue = [...data];
      reorderedDay = dayFull.map((p) => {
        if (p.category === catFilter) {
          const next = queue.shift();
          return next ? { ...next, dayIndex: day } : { ...p, dayIndex: day };
        }
        return { ...p, dayIndex: day };
      });
    }

    reorderedDay = reorderedDay.map((p, i) => ({ ...p, order: i }));
    void applyPlaces(renumberGlobal([...others, ...reorderedDay]));
  };

  const movePlaceToDay = (placeId: string, targetDay: number) => {
    const place = trip.places.find((p) => p.id === placeId);
    if (!place || place.dayIndex === targetDay) return;
    pushUndoSnapshot();
    const without = trip.places.filter((p) => p.id !== placeId);
    const targetOrders = without
      .filter((p) => p.dayIndex === targetDay)
      .map((p) => p.order);
    const maxOrder = targetOrders.length ? Math.max(...targetOrders) : -1;
    const moved: ItineraryPlace = {
      ...place,
      dayIndex: targetDay,
      order: maxOrder + 1,
    };
    void applyPlaces(renumberGlobal([...without, moved]));
    if (day !== targetDay) {
      setSelectedPlaceId(null);
    }
  };

  const promptMoveDay = (place: ItineraryPlace) => {
    const targets = days.filter((d) => d !== place.dayIndex);
    if (targets.length === 0) {
      Alert.alert("이동 불가", "이동할 다른 Day가 없습니다.");
      return;
    }
    Alert.alert(
      "다른 날로 이동",
      `${place.name}\n현재 Day ${place.dayIndex + 1}`,
      [
        ...targets.map((d) => ({
          text: `Day ${d + 1}`,
          onPress: () => movePlaceToDay(place.id, d),
        })),
        { text: "취소", style: "cancel" as const },
      ],
    );
  };

  const deletePlace = (place: ItineraryPlace) => {
    Alert.alert("장소 삭제", `"${place.name}"을(를) 일정에서 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          pushUndoSnapshot();
          const next = trip.places.filter((p) => p.id !== place.id);
          if (selectedPlaceId === place.id) setSelectedPlaceId(null);
          void applyPlaces(renumberGlobal(next));
        },
      },
    ]);
  };

  const deletePlaceSwipe = (place: ItineraryPlace) => {
    pushUndoSnapshot();
    const next = trip.places.filter((p) => p.id !== place.id);
    if (selectedPlaceId === place.id) setSelectedPlaceId(null);
    void applyPlaces(renumberGlobal(next));
  };

  const movePlaceInDay = (placeId: string, direction: "up" | "down") => {
    const dayFull = trip.places
      .filter((p) => p.dayIndex === day)
      .sort((a, b) => a.order - b.order);
    const idx = dayFull.findIndex((p) => p.id === placeId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= dayFull.length) return;
    const next = [...dayFull];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    pushUndoSnapshot();
    const others = trip.places.filter((p) => p.dayIndex !== day);
    const reorderedDay = next.map((p, i) => ({ ...p, order: i, dayIndex: day }));
    void applyPlaces(renumberGlobal([...others, ...reorderedDay]));
  };

  const toggleChecklist = (id: string) => {
    const base = trip.checklist?.length ? trip.checklist : createDefaultChecklist();
    onChangeTrip({
      ...trip,
      checklist: base.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const addSecondaryCity = (cityId: MvpCityId) => {
    const existing = trip.cities?.map((c) => c.cityId) ?? [trip.cityId];
    if (existing.includes(cityId)) return;
    const cityIds = [...existing, cityId] as MvpCityId[];
    const legs = buildCityLegs(cityIds, trip.days);
    const places = trip.places.map((p) => {
      const leg = legs.find((l) => l.dayIndexes.includes(p.dayIndex));
      return { ...p, cityId: leg?.cityId ?? p.cityId };
    });
    onChangeTrip({
      ...trip,
      cities: legs,
      cityName: legs.map((l) => l.cityName).join(" · "),
      places,
      updatedAt: new Date().toISOString(),
    });
    flashInline(`도시 추가 · ${CITIES[cityId].nameKo}`);
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
    flashInline(
      `숙소 선택 · ${cand.name} (${cand.lodgingScore}점)`,
    );
  };

  const insertSuggested = async (category: PlaceCategory) => {
    setSuggestCategory(category);
    setSuggestVisible(true);
    setSuggestList([]);
    setSuggestSource("");
    setSuggesting(true);
    try {
      const res = await suggestPlaces({
        cityId: dayCityId,
        category,
        partySize: trip.partySize,
      });
      setSuggestList(res.places ?? []);
      setSuggestSource(res.source ?? "static");
      if (!res.places?.length) {
        flashInline("이 카테고리 제안이 없습니다.");
        setSuggestVisible(false);
      }
    } catch (e) {
      setSuggestVisible(false);
      Alert.alert(
        "제안 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setSuggesting(false);
    }
  };

  const confirmSuggested = async (pick: ItineraryPlace) => {
    setSuggestVisible(false);
    pushUndoSnapshot();
    const dayList = trip.places.filter((p) => p.dayIndex === day);
    const maxOrder = dayList.reduce((m, p) => Math.max(m, p.order), -1);
    const neu: ItineraryPlace = {
      ...pick,
      id: `place-${Date.now()}`,
      dayIndex: day,
      order: maxOrder + 1,
    };
    await applyPlaces(renumberGlobal([...trip.places, neu]));
    flashInline(`추가됨 · ${neu.name} (Day ${day + 1})`);
  };

  const savePlannedTime = (hhmm: string) => {
    if (!timeEditPlace) return;
    const id = timeEditPlace.id;
    setTimeEditPlace(null);
    onChangeTrip({
      ...trip,
      places: trip.places.map((p) =>
        p.id === id ? { ...p, plannedTime: hhmm } : p,
      ),
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
      const preview = summarizeRerouteChanges(
        trip.places,
        res.places,
        day,
        trip.completedPlaceIds ?? [],
      );
      Alert.alert(
        "재루트 미리보기",
        `${preview.text}\n\n${res.summary}\n엔진: ${res.engine} · 교체 ${res.replacedCount}곳`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "적용",
            style: "default",
            onPress: () => {
              onChangeTrip({
                ...trip,
                places: res.places,
                plannedBudget: res.plannedBudget,
                updatedAt: new Date().toISOString(),
              });
            },
          },
        ],
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

  const runOptimizeDay = async () => {
    const dayList = trip.places
      .filter((p) => p.dayIndex === day)
      .sort((a, b) => a.order - b.order);
    if (dayList.length <= 1) {
      Alert.alert("동선 최적화", "이 Day에 최적화할 장소가 부족합니다.");
      return;
    }
    setOptimizing(true);
    try {
      const res = await optimizeDay({
        places: trip.places,
        dayIndex: day,
        cityId: dayCityId,
      });
      const before = res.before?.join(" → ") || "(없음)";
      const after = res.after?.join(" → ") || "(없음)";
      const kmLine =
        res.pathKmBefore != null && res.pathKmAfter != null
          ? `\n경로 ~${res.pathKmBefore}km → ~${res.pathKmAfter}km`
          : "";
      Alert.alert(
        "동선 최적화 미리보기",
        `${res.summary}\n엔진: ${res.engine}${kmLine}\n\n이전:\n${before}\n\n이후:\n${after}`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "적용",
            onPress: () => {
              pushUndoSnapshot();
              void applyPlaces(res.places);
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        "최적화 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setOptimizing(false);
    }
  };

  const openNavToPlace = (place: ItineraryPlace) => {
    const daySorted = trip.places
      .filter((p) => p.dayIndex === place.dayIndex)
      .sort((a, b) => a.order - b.order);
    const idx = daySorted.findIndex((p) => p.id === place.id);
    const prev = idx > 0 ? daySorted[idx - 1] : null;
    void openMapsDirections(
      { lat: place.lat, lng: place.lng, name: place.name },
      prev ? { lat: prev.lat, lng: prev.lng } : null,
    ).catch((e) => {
      Alert.alert(
        "길안내 실패",
        e instanceof Error ? e.message : "지도를 열 수 없습니다.",
      );
    });
  };

  const openNavSelectedOrNext = () => {
    const selected = selectedPlaceId
      ? trip.places.find((p) => p.id === selectedPlaceId)
      : null;
    const target =
      selected ||
      nextAction?.place ||
      dayPlaces.find((p) => !(trip.completedPlaceIds ?? []).includes(p.id)) ||
      dayPlaces[0];
    if (!target) {
      Alert.alert("길안내", "안내할 장소가 없습니다.");
      return;
    }
    openNavToPlace(target);
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
        <Swipeable
          overshootRight={false}
          renderRightActions={() => (
            <Pressable
              style={styles.swipeDelete}
              onPress={() => deletePlaceSwipe(item)}
              accessibilityLabel="스와이프 삭제"
            >
              <Text style={styles.swipeDeleteText}>삭제</Text>
            </Pressable>
          )}
        >
          <View style={styles.placeCard}>
          {travel ? (
            <Pressable
              onPress={() => void openTransportCompare(item)}
              style={styles.compareChip}
              hitSlop={6}
              accessibilityLabel="이동 비교"
            >
              <Text style={styles.compareChipText}>이동 · 비교 › {travel}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void openTransportCompare(item)}
              style={styles.compareChipMuted}
              accessibilityLabel="이동 비교"
            >
              <Text style={styles.compareChipMutedText}>이동 · 비교</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setSelectedPlaceId(item.id)}
            style={[
              styles.row,
              isActive && styles.rowActive,
              selected && styles.rowSelected,
              done && styles.rowDone,
            ]}
          >
            <Pressable
              onLongPress={drag}
              delayLongPress={120}
              hitSlop={HANDLE_HIT_SLOP}
              style={styles.dragHandle}
              accessibilityLabel="순서 변경 핸들"
              accessibilityHint="길게 눌러 순서를 바꿉니다"
            >
              <Text style={styles.drag}>≡</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Pressable
                  onPress={() => setTimeEditPlace(item)}
                  style={styles.timeBtn}
                  accessibilityLabel="예정 시각 편집"
                >
                  <Text style={styles.timeText}>
                    {item.plannedTime ? `🕒 ${item.plannedTime}` : "🕒 --:--"}
                  </Text>
                </Pressable>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.meta}>
                {CATEGORY_LABEL[item.category] || item.category} ·{" "}
                {formatYen(item.estimatedCost)}
                {item.category === "hotel" && item.lodgingScore
                  ? ` · 숙소점수 ${item.lodgingScore}`
                  : ""}
                {item.notes ? ` · ${item.notes}` : ""}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => openNavToPlace(item)}
                  style={styles.actionPrimary}
                  accessibilityLabel="길안내"
                >
                  <Text style={styles.actionPrimaryText}>길안내</Text>
                </Pressable>
                <Pressable
                  onPress={() => promptMoveDay(item)}
                  style={styles.actionBtn}
                  accessibilityLabel="다른 날로 이동"
                >
                  <Text style={styles.actionBtnText}>Day▶</Text>
                </Pressable>
                <Pressable
                  onPress={() => deletePlace(item)}
                  style={styles.actionDanger}
                  accessibilityLabel="장소 삭제"
                >
                  <Text style={styles.actionDangerText}>삭제</Text>
                </Pressable>
                {trip.status === "active" ? (
                  <Pressable
                    onPress={() => markDone(item.id)}
                    style={styles.actionDone}
                  >
                    <Text style={styles.actionDoneText}>
                      {done ? "✓" : "완료"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Pressable>
        </View>
        </Swipeable>
      </ScaleDecorator>
    );
  };

  const listHeader = (
    <View>
      <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
        <Text style={[styles.back, { color: colors.accent }]}>← 목록</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>
        {tripCitiesLabel(trip)} {trip.nights}박 {trip.days}일
      </Text>
      <Text style={styles.sub}>
        {trip.partySize}명 · 계획 {formatYen(trip.plannedBudget)} ·{" "}
        {STATUS_LABEL[trip.status] ?? trip.status}
      </Text>
      <WeatherCrowdChip cityId={dayCityId} />
      {enriching ? (
        <View style={styles.enrichBar}>
          <ActivityIndicator size="small" color="#0369a1" />
          <Text style={styles.enrichText}>교통 재계산 중…</Text>
        </View>
      ) : null}
      {inlineMsg ? (
        <View style={styles.inlineToast}>
          <Text style={styles.inlineToastText}>{inlineMsg}</Text>
        </View>
      ) : null}

      {!bannerHidden && trip.status === "active" && viewMode === "list" ? (
        <NextActionBanner
          next={nextAction}
          onMarkDone={
            nextAction ? () => markDone(nextAction.place.id) : undefined
          }
          onDismiss={() => setViewMode("field")}
        />
      ) : null}

      {trip.status === "active" ? (
        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              viewMode === "field" && [styles.tabOn, { backgroundColor: colors.chipOnBg }],
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setViewMode("field");
              setBannerHidden(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="현장"
          >
            <Text
              style={[styles.tabText, viewMode === "field" && styles.tabTextOn]}
            >
              현장
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              viewMode === "list" && [styles.tabOn, { backgroundColor: colors.chipOnBg }],
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setViewMode("list");
            }}
            accessibilityRole="button"
            accessibilityLabel="일정"
          >
            <Text
              style={[styles.tabText, viewMode === "list" && styles.tabTextOn]}
            >
              일정
            </Text>
          </Pressable>
        </View>
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

      <Pressable
        style={styles.moreBtn}
        onPress={() => setSettingsOpen((v) => !v)}
      >
        <Text style={styles.moreBtnText}>
          {settingsOpen ? "▾ 여행 설정" : "⋯ 더보기 · 여행 설정"}
        </Text>
      </Pressable>
      {settingsOpen ? (
        <View style={styles.settingsBox}>
          <Text style={styles.settingsHint}>
            ≡ 길게 눌러 순서 · 이동·비교 · Day▶ · 🕒 시각 · 하단 실행 취소
          </Text>
          <View style={styles.toggles}>
            <Pressable
              style={[
                styles.toggle,
                trip.guideAlarmsEnabled && styles.toggleOn,
              ]}
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
          <ChecklistSection items={checklist} onToggle={toggleChecklist} />
          {secondaryCityToAdd ? (
            <Pressable
              style={styles.addCityBtn}
              onPress={() => addSecondaryCity(secondaryCityToAdd)}
            >
              <Text style={styles.addCityBtnText}>
                도시 추가 · {CITIES[secondaryCityToAdd].nameKo}
              </Text>
            </Pressable>
          ) : null}
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
                    {formatLodgingScoreLines(c.scoreBreakdown).map((line) => (
                      <Text key={line} style={styles.lodgingMeta}>
                        · {line}
                      </Text>
                    ))}
                    <Text style={styles.lodgingMeta}>
                      {formatYen(c.estimatedCost)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Day 선택</Text>
      <View style={styles.tabs}>
        {days.map((d) => (
          <Pressable
            key={d}
            style={[
              styles.tab,
              day === d && [styles.tabOn, { backgroundColor: colors.chipOnBg }],
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setDay(d);
              setSelectedPlaceId(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isMultiCity
                ? `Day ${d + 1} ${CITIES[cityIdForDay(trip, d)].nameKo}`
                : `Day ${d + 1}`
            }
          >
            <Text style={[styles.tabText, day === d && styles.tabTextOn]}>
              Day {d + 1}
            </Text>
            {isMultiCity ? (
              <Text style={styles.tabCityHint}>
                {CITIES[cityIdForDay(trip, d)].nameKo}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.mapPane}>
        <PlanDayMap
          cityId={dayCityId}
          places={mapPlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          onMoveInDay={movePlaceInDay}
        />
      </View>

      <Text style={styles.sectionLabel}>카테고리 · 장소 추가</Text>
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
              +{CATEGORY_LABEL[c] || c}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.optimizeBtn, optimizing && { opacity: 0.6 }]}
        disabled={optimizing}
        onPress={() => void runOptimizeDay()}
      >
        {optimizing ? (
          <ActivityIndicator color="#0c4a6e" />
        ) : (
          <Text style={styles.optimizeBtnText}>동선 최적화</Text>
        )}
      </Pressable>
      <Text style={styles.sectionLabel}>
        Day {day + 1} 일정 ({dayPlaces.length})
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {isFieldMode ? (
        <View style={styles.fieldRoot}>
          <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
            <Text style={[styles.back, { color: colors.accent }]}>← 목록</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            {tripCitiesLabel(trip)} · 현장 모드
          </Text>
          <Text style={styles.sub}>
            Day {day + 1} · 한 손 조작 ·{" "}
            {STATUS_LABEL[trip.status] ?? trip.status}
          </Text>
          <WeatherCrowdChip cityId={dayCityId} />
          <ChecklistSection
            items={checklist}
            onToggle={toggleChecklist}
            compact
          />
          {inlineMsg ? (
            <View style={styles.inlineToast}>
              <Text style={styles.inlineToastText}>{inlineMsg}</Text>
            </View>
          ) : null}
          <NextActionBanner
            fieldMode
            next={nextAction}
            rerouting={rerouting}
            onMarkDone={
              nextAction ? () => markDone(nextAction.place.id) : undefined
            }
            onNavigate={openNavSelectedOrNext}
            onReroute={() =>
              void runReroute("현장: 사용자가 남은 일정 재조정 요청")
            }
            onDismiss={() => setViewMode("list")}
          />
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
          <Text style={styles.sectionLabel}>Day</Text>
          <View style={styles.tabs}>
            {days.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.tab,
                  day === d && [styles.tabOn, { backgroundColor: colors.chipOnBg }],
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setDay(d);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isMultiCity
                    ? `Day ${d + 1} ${CITIES[cityIdForDay(trip, d)].nameKo}`
                    : `Day ${d + 1}`
                }
              >
                <Text style={[styles.tabText, day === d && styles.tabTextOn]}>
                  Day {d + 1}
                </Text>
                {isMultiCity ? (
                  <Text style={styles.tabCityHint}>
                    {CITIES[cityIdForDay(trip, d)].nameKo}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.fieldMap}>
            <PlanDayMap
              cityId={dayCityId}
              places={mapPlaces}
              selectedPlaceId={nextAction?.place.id ?? selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              onMoveInDay={movePlaceInDay}
            />
          </View>
          <Pressable
            style={styles.fieldListLink}
            onPress={() => setViewMode("list")}
          >
            <Text style={styles.fieldListLinkText}>전체 일정·지도 보기</Text>
          </Pressable>
        </View>
      ) : (
        <DraggableFlatList
          data={dayPlaces}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => reorder(data)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          activationDistance={12}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>이 날 일정이 비어 있습니다</Text>
              <Text style={styles.empty}>
                위에서 +음식 · +관광 · +숙소로 장소를 추가하거나, 다른 Day에서
                Day▶로 옮겨 오세요.
              </Text>
            </View>
          }
        />
      )}

      {undoVisible ? (
        <View style={[styles.undoBar, { backgroundColor: colors.undoBg }]}>
          <Text style={[styles.undoLabel, { color: colors.undoFg }]}>
            {undoDepth > 1
              ? `변경됨 · 되돌리기 ${undoDepth}단계`
              : "일정이 변경되었습니다"}
          </Text>
          <Pressable
            onPress={undoLastChange}
            accessibilityRole="button"
            accessibilityLabel="실행 취소"
          >
            <Text style={{ color: colors.undoFg, fontWeight: "800", fontSize: 13 }}>
              실행 취소{undoDepth > 1 ? ` (${undoDepth})` : ""}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.btnPrimary}
          onPress={openNavSelectedOrNext}
          accessibilityRole="button"
          accessibilityLabel="길안내"
        >
          <Text style={styles.btnPrimaryText}>길안내</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onExpenses}>
          <Text style={styles.btnText}>경비</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onSummary}>
          <Text style={styles.btnText}>요약</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.btnGhost} onPress={onMap}>
          <Text style={styles.btnGhostText}>전체지도</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={onCapture}>
          <Text style={styles.btnGhostText}>리뷰</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.btnAlt}
          onPress={() => setStatus("active")}
          accessibilityRole="button"
          accessibilityLabel="여행 시작"
        >
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
        onOpenMapsTransit={
          comparePlace
            ? () => {
                openNavToPlace(comparePlace);
              }
            : undefined
        }
      />

      <PlaceSuggestModal
        visible={suggestVisible}
        categoryLabel={CATEGORY_LABEL[suggestCategory] || suggestCategory}
        places={suggestList}
        source={suggestSource}
        loading={suggesting}
        onPick={(p) => void confirmSuggested(p)}
        onClose={() => setSuggestVisible(false)}
      />

      <PlannedTimeModal
        visible={timeEditPlace != null}
        placeName={timeEditPlace?.name ?? ""}
        initialTime={timeEditPlace?.plannedTime || "09:00"}
        onSave={savePlannedTime}
        onClose={() => setTimeEditPlace(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backHit: {
    alignSelf: "flex-start",
    minHeight: TOUCH_MIN,
    justifyContent: "center",
    marginBottom: 2,
  },
  back: { color: "#0369a1", fontWeight: "700", fontSize: 15 },
  title: { fontSize: 20, fontWeight: "800", color: "#0c4a6e" },
  sub: { color: "#64748b", marginTop: 2 },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#0c4a6e",
  },
  tip: { marginTop: 8, marginBottom: 8, fontSize: 12, color: "#94a3b8" },
  moreBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
  },
  moreBtnText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  settingsBox: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  settingsHint: { fontSize: 11, color: "#94a3b8", marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  timeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: TOUCH_MIN,
    minWidth: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: { fontSize: 12, fontWeight: "800", color: "#0369a1" },
  enrichBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  enrichText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  inlineToast: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineToastText: { color: "#e0f2fe", fontSize: 13, fontWeight: "600" },
  mapPane: {
    height: MAP_PANE_HEIGHT,
    marginBottom: 10,
  },
  toggles: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#0c4a6e" },
  toggleText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  toggleTextOn: { color: "#fff" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: "#0369a1" },
  tabText: { color: "#334155", fontWeight: "700" },
  tabTextOn: { color: "#fff" },
  tabCityHint: { color: "#64748b", fontSize: 10, fontWeight: "600", marginTop: 2 },
  addCityBtn: {
    marginBottom: 8,
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
  },
  addCityBtnText: { color: "#0e7490", fontWeight: "800", fontSize: 13 },
  swipeDelete: {
    backgroundColor: "#dc2626",
    justifyContent: "center",
    padding: 16,
    minWidth: 80,
  },
  swipeDeleteText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: "#0c4a6e" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  insertRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  insertBtn: {
    flex: 1,
    backgroundColor: "#f0f9ff",
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  insertText: { color: "#0369a1", fontSize: 12, fontWeight: "800" },
  optimizeBtn: {
    marginBottom: 10,
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
  },
  optimizeBtnText: { color: "#0e7490", fontWeight: "800", fontSize: 13 },
  fieldRoot: { flex: 1, paddingBottom: 4 },
  fieldMap: { flex: 1, minHeight: 180, marginTop: 8, marginBottom: 8 },
  fieldListLink: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: TOUCH_MIN,
    justifyContent: "center",
  },
  fieldListLinkText: { color: "#0369a1", fontWeight: "700", fontSize: 14 },
  lodgingBox: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: "#fff7ed",
    borderRadius: 12,
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
    paddingVertical: 8,
    minHeight: TOUCH_MIN,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#fdba74",
  },
  lodgingOn: { backgroundColor: "#ffedd5" },
  lodgingName: { fontWeight: "700", color: "#7c2d12", fontSize: 12 },
  lodgingMeta: { fontSize: 10, color: "#c2410c", marginTop: 2 },
  placeCard: { marginBottom: 10 },
  compareChip: {
    alignSelf: "flex-start",
    marginBottom: 4,
    marginLeft: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#7dd3fc",
    justifyContent: "center",
  },
  compareChipText: {
    fontSize: 13,
    color: "#0369a1",
    fontWeight: "800",
  },
  compareChipMuted: {
    alignSelf: "flex-start",
    marginBottom: 4,
    marginLeft: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
  },
  compareChipMutedText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  rowActive: { backgroundColor: "#e0f2fe", borderColor: "#38bdf8" },
  rowSelected: { borderColor: "#0284c7", backgroundColor: "#f0f9ff" },
  rowDone: { opacity: 0.55 },
  dragHandle: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
  },
  drag: { fontSize: 22, color: "#64748b", width: 22, textAlign: "center" },
  name: { flex: 1, fontWeight: "700", color: "#0f172a", fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  actionPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#0c4a6e",
    justifyContent: "center",
  },
  actionPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
  },
  actionBtnText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  actionDanger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
  },
  actionDangerText: { color: "#b91c1c", fontWeight: "700", fontSize: 13 },
  actionDone: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
  },
  actionDoneText: { color: "#047857", fontWeight: "800", fontSize: 13 },
  emptyBox: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#0c4a6e",
    marginBottom: 6,
    fontSize: 15,
  },
  empty: { color: "#64748b", lineHeight: 20, fontSize: 13 },
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  undoLabel: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    borderRadius: 8,
    backgroundColor: "#38bdf8",
    justifyContent: "center",
  },
  undoBtnText: { color: "#0c4a6e", fontWeight: "800", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  btnPrimary: {
    flex: 1.4,
    backgroundColor: "#0c4a6e",
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  btn: {
    flex: 1,
    backgroundColor: "#0369a1",
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnGhost: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnGhostText: { color: "#475569", fontWeight: "700", fontSize: 13 },
  btnAlt: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAltText: { color: "#075985", fontWeight: "700", fontSize: 13 },
});
