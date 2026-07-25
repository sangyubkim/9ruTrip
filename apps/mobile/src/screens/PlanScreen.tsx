import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  compareTransport,
  enrichTransport,
  optimizeDay,
  rerouteTrip,
  suggestPlaces,
} from "../api/trip";
import { DeviationBanner } from "../components/DeviationBanner";
import { EmptyState } from "../components/EmptyState";
import { FadeIn } from "../components/FadeIn";
import { InlineToast } from "../components/InlineToast";
import { NextActionBanner } from "../components/NextActionBanner";
import { PlaceSuggestModal } from "../components/PlaceSuggestModal";
import { PlanCoachmark } from "../components/PlanCoachmark";
import { PlannedTimeModal } from "../components/PlannedTimeModal";
import { PlanDayMap } from "../components/PlanDayMap";
import { ProvinceCityPickerModal } from "../components/ProvinceCityPickerModal";
import { TransportCompareSheet } from "../components/TransportCompareSheet";
import { WeatherCrowdChip } from "../components/WeatherCrowdChip";
import { useGpsDeviation } from "../hooks/useGpsDeviation";
import { useGuideAlarms } from "../hooks/useGuideAlarms";
import { useReduceMotion } from "../hooks/useReduceMotion";
import {
  hasSeenPlanCoach,
  markPlanCoachSeen,
} from "../storage/planCoachStorage";
import {
  loadPlanUiMode,
  savePlanUiMode,
  type PlanUiMode,
} from "../storage/planUiModeStorage";
import {
  hasSeenFieldGuideToast,
  markFieldGuideToastSeen,
} from "../storage/fieldGuideToastStorage";
import {
  assignDayToCity,
  buildCityLegs,
  CITIES,
  cityIdForDay,
  DOMESTIC_CITY_IDS,
  isDomesticCityId,
  OVERSEAS_CITY_IDS,
  tripCitiesLabel,
  DEFAULT_LODGING_RETURN_TIME,
  DEFAULT_START_TIME,
  type ItineraryPlace,
  type MvpCityId,
  type PlaceCategory,
  type TransportMode,
  type TransportOption,
  type Trip,
} from "../types";
import {
  MAX_SELECTED_CITIES,
  citiesInCountry,
  getCountryForCity,
} from "../data/destinations";
import { useTheme } from "../theme/ThemeContext";
import { space } from "../theme/tokens";
import {
  CATEGORY_LABEL,
  currencyForCity,
  formatHotelBreakfastLabel,
  formatHotelBreakfastPrice,
  formatMoney,
  formatPlaceMoney,
  placeBudgetAmount,
  STATUS_LABEL,
} from "../utils/cost";
import {
  naverModeFromTransport,
  openMapsDirections,
  openNaverMapsDirections,
  openTransitDeepLink,
} from "../utils/mapsNavigation";
import { formatTravelGlance, getNextAction } from "../utils/nextAction";
import {
  ensureOvernightHotelsInPlaces,
  overnightDayIndexes,
} from "../utils/overnightHotels";
import { summarizeRerouteChanges } from "../utils/reroutePreview";

type Props = {
  trip: Trip;
  onChangeTrip: (trip: Trip) => void;
  onBack: () => void;
  onTripEnded?: () => void;
  onMap: (dayIndex?: number) => void;
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

function budgetOf(places: ItineraryPlace[], partySize: number): number {
  return places.reduce((s, p) => s + placeBudgetAmount(p, partySize), 0);
}

export function PlanScreen({
  trip,
  onChangeTrip,
  onBack,
  onTripEnded,
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
  const [listDragging, setListDragging] = useState(false);
  const [planCoachVisible, setPlanCoachVisible] = useState(false);
  const [planUiMode, setPlanUiMode] = useState<PlanUiMode>("easy");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [returnTimeEditOpen, setReturnTimeEditOpen] = useState(false);
  const [startTimeEditOpen, setStartTimeEditOpen] = useState(false);
  const [reflectRequest, setReflectRequest] = useState("");
  const [reflectRequestOpen, setReflectRequestOpen] = useState(false);
  const [completionBriefingVisible, setCompletionBriefingVisible] =
    useState(false);
  const [domesticNavPlace, setDomesticNavPlace] =
    useState<ItineraryPlace | null>(null);
  const [domesticNavApp, setDomesticNavApp] = useState<"naver" | "google">(
    "naver",
  );

  const undoStackRef = useRef<ItineraryPlace[][]>([]);
  const inlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoOpacity = useRef(new Animated.Value(0)).current;

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const money = (n: number) => formatMoney(n, currencyForCity(trip.cityId));
  const reduceMotion = useReduceMotion();
  const isEasy = planUiMode === "easy";

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
  const existingCityIds =
    trip.cities?.map((c) => c.cityId) ?? ([trip.cityId] as MvpCityId[]);
  const cityPool: MvpCityId[] = isDomesticCityId(trip.cityId)
    ? DOMESTIC_CITY_IDS
    : getCountryForCity(trip.cityId)?.id != null
      ? citiesInCountry(getCountryForCity(trip.cityId)!.id).map((c) => c.id)
      : OVERSEAS_CITY_IDS;
  const canPickDomesticCities = isDomesticCityId(trip.cityId);

  useEffect(() => {
    if (trip.status === "active") {
      setViewMode("field");
      setBannerHidden(false);
    } else {
      setViewMode("list");
    }
  }, [trip.status]);

  useEffect(() => {
    let cancelled = false;
    void hasSeenPlanCoach().then((seen) => {
      if (!cancelled && !seen) setPlanCoachVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPlanUiMode().then((mode) => {
      if (!cancelled) setPlanUiMode(mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissPlanCoach = () => {
    setPlanCoachVisible(false);
    void markPlanCoachSeen();
  };

  const setUiMode = (mode: PlanUiMode) => {
    setPlanUiMode(mode);
    void savePlanUiMode(mode);
  };

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

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (inlineTimerRef.current) clearTimeout(inlineTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      undoOpacity.setValue(undoVisible ? 1 : 0);
      return;
    }
    Animated.timing(undoOpacity, {
      toValue: undoVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [undoVisible, reduceMotion, undoOpacity]);

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
      plannedBudget: budgetOf(places, trip.partySize),
      updatedAt: new Date().toISOString(),
    };
    onChangeTrip(localTrip);
    setEnriching(true);
    try {
      const startHour = (() => {
        const m = String(trip.startTime || DEFAULT_START_TIME).match(
          /^(\d{1,2})/,
        );
        const h = m ? Number(m[1]) : 9;
        return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
      })();
      const res = await enrichTransport(places, true, trip.cityId, {
        startHour,
        startTime: trip.startTime || DEFAULT_START_TIME,
        lodgingReturnTime:
          trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME,
        startLat: trip.startLat,
        startLng: trip.startLng,
        outboundTransportMode: trip.outboundTransportMode || "car",
      });
      onChangeTrip({
        ...localTrip,
        places: res.places,
        plannedBudget: budgetOf(res.places, trip.partySize),
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

  /** 지도 순서 모드 스트립 — id 배열로 당일 전체 재정렬 */
  const reorderDayByIds = (orderedIds: string[]) => {
    const dayFull = trip.places
      .filter((p) => p.dayIndex === day)
      .sort((a, b) => a.order - b.order);
    const byId = new Map(dayFull.map((p) => [p.id, p]));
    const next: ItineraryPlace[] = [];
    for (const id of orderedIds) {
      const p = byId.get(id);
      if (p) next.push(p);
    }
    for (const p of dayFull) {
      if (!orderedIds.includes(p.id)) next.push(p);
    }
    if (next.length === 0) return;
    pushUndoSnapshot();
    const others = trip.places.filter((p) => p.dayIndex !== day);
    const reorderedDay = next.map((p, i) => ({ ...p, order: i, dayIndex: day }));
    void applyPlaces(renumberGlobal([...others, ...reorderedDay]));
  };

  const promptAssignDayCity = (targetCity: MvpCityId) => {
    if (cityIdForDay(trip, day) === targetCity) return;
    const dayPlaceCount = trip.places.filter((p) => p.dayIndex === day).length;
    const apply = (updatePlaces: boolean) => {
      const next = assignDayToCity(trip, day, targetCity, updatePlaces);
      onChangeTrip(next);
      flashInline(
        `Day ${day + 1} → ${CITIES[targetCity].nameKo}` +
          (updatePlaces ? " · 장소 cityId 갱신" : ""),
      );
    };
    if (dayPlaceCount === 0) {
      apply(false);
      return;
    }
    Alert.alert(
      "Day 도시 배정",
      `Day ${day + 1}을(를) ${CITIES[targetCity].nameKo}로 배정할까요?\n장소 ${dayPlaceCount}곳의 cityId도 맞출까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "도시만 (장소 유지)",
          onPress: () => apply(false),
        },
        {
          text: "장소 cityId도 갱신",
          onPress: () => apply(true),
        },
      ],
    );
  };

  const runLayoutAnim = () => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const applyProvinceCities = (picked: string[]) => {
    const cityIds = [
      ...new Set(picked.filter((id) => CITIES[id])),
    ].slice(0, MAX_SELECTED_CITIES) as MvpCityId[];
    if (!cityIds.length) {
      Alert.alert("도시 필요", "도시를 하나 이상 선택해 주세요.");
      return;
    }
    const legs = buildCityLegs(cityIds, trip.days);
    const places = trip.places.map((p) => {
      const leg = legs.find((l) => l.dayIndexes.includes(p.dayIndex));
      return { ...p, cityId: leg?.cityId ?? cityIds[0] };
    });
    onChangeTrip({
      ...trip,
      cityId: cityIds[0],
      cities: legs,
      cityName: legs.map((l) => l.cityName).join(" · "),
      places,
      mapProvider: CITIES[cityIds[0]]?.mapProvider ?? trip.mapProvider,
      updatedAt: new Date().toISOString(),
    });
    setCityPickerOpen(false);
    flashInline(
      `여행지 적용 · ${legs.map((l) => l.cityName).join(" · ")}`,
    );
  };

  const addSecondaryCity = (cityId: MvpCityId) => {
    const existing = trip.cities?.map((c) => c.cityId) ?? [trip.cityId];
    if (existing.includes(cityId)) return;
    if (existing.length >= MAX_SELECTED_CITIES) {
      Alert.alert(
        "도시 한도",
        `여행지는 최대 ${MAX_SELECTED_CITIES}곳까지 선택할 수 있습니다.`,
      );
      return;
    }
    applyProvinceCities([...existing, cityId]);
  };

  const setStatus = (status: Trip["status"]) => {
    onChangeTrip({ ...trip, status, updatedAt: new Date().toISOString() });
    if (status === "active") {
      setViewMode("field");
      setBannerHidden(false);
      void hasSeenFieldGuideToast().then((seen) => {
        if (!seen) {
          flashInline("현장 모드로 안내합니다");
          void markFieldGuideToastSeen();
        }
      });
    }
  };

  const finishTrip = () => {
    const completedPlaceIds = Array.from(
      new Set([
        ...(trip.completedPlaceIds ?? []),
        ...trip.places.map((place) => place.id),
      ]),
    );
    onChangeTrip({
      ...trip,
      completedPlaceIds,
      status: "done",
      updatedAt: new Date().toISOString(),
    });
    setCompletionBriefingVisible(true);
  };

  const endTrip = () => {
    const completed = new Set(trip.completedPlaceIds ?? []);
    const incompleteCount = trip.places.filter(
      (place) => !completed.has(place.id),
    ).length;
    if (incompleteCount === 0) {
      finishTrip();
      return;
    }

    Alert.alert(
      "여행 종료",
      `미완료 장소 ${incompleteCount}곳이 있어요. 그래도 종료할까요?`,
      [
        { text: "취소", style: "cancel" },
        { text: "그래도 종료", style: "destructive", onPress: finishTrip },
      ],
    );
  };

  const toggle = (key: "aiRerouteEnabled" | "guideAlarmsEnabled") => {
    onChangeTrip({
      ...trip,
      [key]: !trip[key],
      updatedAt: new Date().toISOString(),
    });
  };

  const tripStartTime = trip.startTime || DEFAULT_START_TIME;
  const lodgingReturnTime =
    trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME;

  const saveTripStartTime = (hhmm: string) => {
    onChangeTrip({
      ...trip,
      startTime: hhmm,
      updatedAt: new Date().toISOString(),
    });
    setStartTimeEditOpen(false);
    flashInline(`여행 시작 ${hhmm}`);
  };

  const saveLodgingReturnTime = (hhmm: string) => {
    onChangeTrip({
      ...trip,
      lodgingReturnTime: hhmm,
      updatedAt: new Date().toISOString(),
    });
    setReturnTimeEditOpen(false);
    flashInline(`숙소 복귀 ${hhmm}`);
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

  const confirmSuggested = async (picks: ItineraryPlace[]) => {
    setSuggestVisible(false);
    if (!picks.length) return;
    pushUndoSnapshot();

    if (suggestCategory === "hotel") {
      const pick = picks[0];
      // 숙박일(마지막 날 제외)이면 전 숙박 Day에 동일 숙소, 아니면 당일만
      const overnight = overnightDayIndexes(trip.days, trip.nights);
      const daysToSet =
        overnight.length > 0 && day < trip.days - 1 ? overnight : [day];
      let next = trip.places.filter(
        (p) => !(p.category === "hotel" && daysToSet.includes(p.dayIndex)),
      );
      const baseId = Date.now();
      for (const d of daysToSet) {
        const dayList = next.filter((p) => p.dayIndex === d);
        const maxOrder = dayList.reduce((m, p) => Math.max(m, p.order), -1);
        next.push({
          ...pick,
          id: `place-${baseId}-${d}`,
          dayIndex: d,
          order: maxOrder + 1,
          cityId: cityIdForDay(trip, d) || dayCityId,
          notes: pick.notes || "숙소 복귀",
        });
      }
      await applyPlaces(renumberGlobal(next), {
        preferredLodgingId: pick.id,
      });
      flashInline(
        daysToSet.length > 1
          ? `숙소 선택 · ${pick.name} (Day 1~${trip.days - 1})`
          : `숙소 선택 · ${pick.name} (Day ${day + 1})`,
      );
      return;
    }

    const dayList = trip.places.filter((p) => p.dayIndex === day);
    const existingNames = new Set(
      dayList.map((p) => p.name.trim().toLowerCase().replace(/\s+/g, "")),
    );
    let maxOrder = dayList.reduce((m, p) => Math.max(m, p.order), -1);
    const added: ItineraryPlace[] = [];
    for (const pick of picks) {
      const key = pick.name.trim().toLowerCase().replace(/\s+/g, "");
      if (existingNames.has(key)) continue;
      maxOrder += 1;
      existingNames.add(key);
      added.push({
        ...pick,
        id: `place-${Date.now()}-${added.length}`,
        dayIndex: day,
        order: maxOrder,
        cityId: dayCityId,
      });
    }
    if (!added.length) {
      flashInline("이미 일정에 있는 장소입니다.");
      return;
    }
    await applyPlaces(renumberGlobal([...trip.places, ...added]));
    flashInline(`추가됨 · ${added.length}곳 (Day ${day + 1})`);
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
              const places = ensureOvernightHotelsInPlaces(res.places, {
                days: trip.days,
                nights: trip.nights,
                lodgingCandidates: trip.lodgingCandidates,
                preferredLodgingId: trip.preferredLodgingId,
                cityId: trip.cityId,
                lodgingReturnTime:
                  trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME,
              });
              onChangeTrip({
                ...trip,
                places,
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

  const runReflectRequest = async () => {
    const reason = reflectRequest.trim();
    if (!reason) {
      Alert.alert(
        "요청 필요",
        "예: 오후에 카페 추가, 너무 빡빡하니 일정 줄여줘",
      );
      return;
    }
    setRerouting(true);
    try {
      const res = await rerouteTrip({
        trip: {
          ...trip,
          lodgingReturnTime:
            trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME,
        },
        dayIndex: day,
        reason,
        mode: "reflect",
        lodgingReturnTime:
          trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME,
        completedPlaceIds: trip.completedPlaceIds ?? [],
      });
      const preview = summarizeRerouteChanges(
        trip.places,
        res.places,
        day,
        trip.completedPlaceIds ?? [],
      );
      Alert.alert(
        "일정 반영 미리보기",
        `${preview.text}\n\n${res.summary}\n엔진: ${res.engine} · 교체 ${res.replacedCount}곳`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "적용",
            onPress: () => {
              pushUndoSnapshot();
              const places = ensureOvernightHotelsInPlaces(res.places, {
                days: trip.days,
                nights: trip.nights,
                lodgingCandidates: trip.lodgingCandidates,
                preferredLodgingId: trip.preferredLodgingId,
                cityId: trip.cityId,
                lodgingReturnTime:
                  trip.lodgingReturnTime || DEFAULT_LODGING_RETURN_TIME,
              });
              onChangeTrip({
                ...trip,
                places,
                plannedBudget: res.plannedBudget,
                extraRequest: reason,
                updatedAt: new Date().toISOString(),
              });
              setReflectRequest("");
              flashInline(`Day ${day + 1} 일정 반영 완료`);
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        "일정 반영 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setRerouting(false);
    }
  };

  const resolveNavEndpoints = (place: ItineraryPlace) => {
    const daySorted = trip.places
      .filter((p) => p.dayIndex === place.dayIndex)
      .sort((a, b) => a.order - b.order);
    const idx = daySorted.findIndex((p) => p.id === place.id);
    const prev = idx > 0 ? daySorted[idx - 1] : null;
    return {
      dest: { lat: place.lat, lng: place.lng, name: place.name },
      origin: prev
        ? { lat: prev.lat, lng: prev.lng, name: prev.name }
        : null,
      transitOpt: place.transportOptions?.find((o) => o.mode === "transit"),
    };
  };

  const showNavigationError = (e: unknown) => {
    Alert.alert(
      "길안내 실패",
      e instanceof Error ? e.message : "지도를 열 수 없습니다.",
    );
  };

  const openSelectedDomesticNavigation = () => {
    if (!domesticNavPlace) return;
    const place = domesticNavPlace;
    const app = domesticNavApp;
    const { dest, origin, transitOpt } = resolveNavEndpoints(place);
    const preferTransit =
      place.preferredTransportMode === "transit" ||
      !place.preferredTransportMode;
    const naverMode = naverModeFromTransport(place.preferredTransportMode);

    setDomesticNavPlace(null);
    if (app === "naver") {
      if (preferTransit) {
        void openTransitDeepLink(
          "naver",
          dest,
          origin,
          transitOpt?.deepLinks,
          naverMode,
        ).catch(showNavigationError);
        return;
      }
      void openNaverMapsDirections(dest, origin, naverMode).catch(
        showNavigationError,
      );
      return;
    }

    if (preferTransit) {
      void openTransitDeepLink(
        "google",
        dest,
        origin,
        transitOpt?.deepLinks,
      ).catch(showNavigationError);
      return;
    }
    void openMapsDirections(dest, origin).catch(showNavigationError);
  };

  const openNavToPlace = (place: ItineraryPlace) => {
    const { dest, origin, transitOpt } = resolveNavEndpoints(place);
    const preferTransit =
      place.preferredTransportMode === "transit" ||
      !place.preferredTransportMode;
    const domestic = isDomesticCityId(dayCityId);
    if (domestic) {
      setDomesticNavApp("naver");
      setDomesticNavPlace(place);
      return;
    }

    // 해외 대중교통: Google + Yahoo
    if (preferTransit) {
      const buttons: {
        text: string;
        style?: "cancel" | "default" | "destructive";
        onPress?: () => void;
      }[] = [];
      buttons.push({
        text: "Google 환승",
        onPress: () => {
          void openTransitDeepLink(
            "google",
            dest,
            origin,
            transitOpt?.deepLinks,
          ).catch(showNavigationError);
        },
      });
      buttons.push({
        text: "Yahoo 환승",
        onPress: () => {
          void openTransitDeepLink(
            "yahoo",
            dest,
            origin,
            transitOpt?.deepLinks,
          ).catch(showNavigationError);
        },
      });
      buttons.push({ text: "취소", style: "cancel" });
      Alert.alert(
        "환승 길안내",
        "정확한 환승은 외부 앱에서 확인하세요. (추정만으로는 환승 불가)",
        buttons,
      );
      return;
    }

    void openMapsDirections(dest, origin).catch(showNavigationError);
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
    getIndex,
  }: RenderItemParams<ItineraryPlace>) => {
    const done = (trip.completedPlaceIds ?? []).includes(item.id);
    const currency = currencyForCity(trip.cityId);
    const travel = formatTravelGlance(item, currency);
    const selected = selectedPlaceId === item.id;
    const swipeEnabled = !listDragging && !isActive;
    const mapNo =
      (typeof getIndex === "function" ? getIndex() : undefined) ??
      dayPlaces.findIndex((p) => p.id === item.id);
    const routeNo = mapNo >= 0 ? mapNo + 1 : null;
    const hotelBreakfastPrice =
      item.category === "hotel"
        ? formatHotelBreakfastPrice(item.breakfastPricePerPerson, currency)
        : null;
    return (
      <ScaleDecorator>
        <Swipeable
          enabled={swipeEnabled}
          overshootRight={false}
          friction={2}
          // 왼쪽 스와이프(삭제)만 활성 · 세로 스크롤 우선
          activeOffsetX={[-24, 48]}
          failOffsetY={[-14, 14]}
          rightThreshold={40}
          renderRightActions={() => (
            <Pressable
              style={styles.swipeDelete}
              onPress={() => deletePlaceSwipe(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 스와이프 삭제`}
              accessibilityHint="왼쪽으로 밀어 나타난 삭제 버튼"
            >
              <Text style={styles.swipeDeleteText}>삭제</Text>
            </Pressable>
          )}
        >
          <View
            style={[
              styles.placeCard,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          >
          {travel ? (
            <Pressable
              onPress={() => void openTransportCompare(item)}
              style={[styles.compareChip, { backgroundColor: colors.accentMuted }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="이동 비교"
            >
              <Text style={[styles.compareChipText, { color: colors.accent }]}>
                {routeNo != null ? `${routeNo} · ` : ""}이동 · 비교 › {travel}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void openTransportCompare(item)}
              style={[styles.compareChipMuted, { backgroundColor: colors.bgMuted }]}
              accessibilityRole="button"
              accessibilityLabel="이동 비교"
            >
              <Text
                style={[styles.compareChipMutedText, { color: colors.textMuted }]}
              >
                {routeNo != null ? `${routeNo} · ` : ""}이동 · 비교
              </Text>
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
              accessibilityRole="button"
              accessibilityLabel="순서 변경 핸들"
              accessibilityHint="≡만 길게 눌러 순서를 바꿉니다. 삭제는 왼쪽 스와이프"
            >
              <Text style={[styles.drag, { color: colors.textMutedOnCard }]}>
                ≡
              </Text>
            </Pressable>
            {routeNo != null ? (
              <View
                style={[
                  styles.mapNoBadge,
                  {
                    backgroundColor: selected
                      ? colors.primary
                      : colors.chipOnBg,
                  },
                ]}
                accessibilityLabel={`지도 ${routeNo}번`}
              >
                <Text
                  style={[
                    styles.mapNoBadgeText,
                    {
                      color: selected ? colors.primaryFg : colors.chipOnFg,
                    },
                  ]}
                >
                  {routeNo}
                </Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Pressable
                  onPress={() => setTimeEditPlace(item)}
                  style={[
                    styles.timeBtn,
                    { backgroundColor: colors.chipOnBg },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="예정 시각 편집"
                >
                  <Text
                    style={[styles.timeText, { color: colors.chipOnFg }]}
                  >
                    {item.plannedTime ? `🕒 ${item.plannedTime}` : "🕒 --:--"}
                  </Text>
                </Pressable>
                <Text
                  style={[styles.name, { color: colors.textOnCard }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
              </View>
              {item.category === "hotel" ? (
                <>
                  <Text
                    style={[styles.meta, { color: colors.textMutedOnCard }]}
                  >
                    숙소 · {formatHotelBreakfastLabel(item.breakfastIncluded)}
                    {" · "}
                    1박 · {formatMoney(item.estimatedCost, currency)}
                    {hotelBreakfastPrice ? ` · ${hotelBreakfastPrice}` : ""}
                    {item.lodgingScore
                      ? ` · 숙소점수 ${item.lodgingScore}`
                      : ""}
                  </Text>
                  <Text
                    style={[styles.estimateHint, { color: colors.textMutedOnCard }]}
                  >
                    추정가 · 확정 아님
                  </Text>
                  {item.notes ? (
                    <Text
                      style={[styles.meta, { color: colors.textMutedOnCard }]}
                      numberOfLines={2}
                    >
                      {item.notes}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.meta, { color: colors.textMutedOnCard }]}>
                  {CATEGORY_LABEL[item.category] || item.category} ·{" "}
                  {formatPlaceMoney(
                    item.estimatedCost,
                    item.category,
                    currency,
                  )}
                  {item.notes ? ` · ${item.notes}` : ""}
                </Text>
              )}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => openNavToPlace(item)}
                  style={styles.actionPrimary}
                  accessibilityRole="button"
                  accessibilityLabel="길안내"
                >
                  <Text style={styles.actionPrimaryText}>길안내</Text>
                </Pressable>
                <Pressable
                  onPress={() => promptMoveDay(item)}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="다른 날로 이동"
                >
                  <Text style={styles.actionBtnText}>Day▶</Text>
                </Pressable>
                <Pressable
                  onPress={() => deletePlace(item)}
                  style={styles.actionDanger}
                  accessibilityRole="button"
                  accessibilityLabel="장소 삭제"
                >
                  <Text style={styles.actionDangerText}>삭제</Text>
                </Pressable>
                {trip.status === "active" ? (
                  <Pressable
                    onPress={() => markDone(item.id)}
                    style={styles.actionDone}
                    accessibilityRole="button"
                    accessibilityLabel={done ? "완료됨" : "완료 표시"}
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

  const filterAndInsertBlock = (
    <>
      <View style={styles.insertRow}>
        {(["food", "attraction", "hotel"] as PlaceCategory[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.insertBtn, suggesting && { opacity: 0.6 }]}
            disabled={suggesting}
            onPress={() => void insertSuggested(c)}
          >
            <Text style={styles.insertText}>+{CATEGORY_LABEL[c] || c}</Text>
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
      <Pressable
        style={styles.reflectToggle}
        onPress={() => setReflectRequestOpen((open) => !open)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: reflectRequestOpen }}
        accessibilityLabel="재일정 반영 요청"
        accessibilityHint="선택하면 요청 입력과 여행 재계획 버튼이 표시됩니다"
      >
        <View
          style={[
            styles.reflectCheckbox,
            reflectRequestOpen && styles.reflectCheckboxOn,
          ]}
        >
          {reflectRequestOpen ? (
            <Text style={styles.reflectCheckmark}>✓</Text>
          ) : null}
        </View>
        <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>
          재일정 반영 요청
        </Text>
      </Pressable>
      {reflectRequestOpen ? (
        <>
          <Text style={[styles.settingsHint, { color: colors.textMuted }]}>
            Day {day + 1} 일정에 반영할 요청을 적고 AI로 경로를 다시 받을 수 있습니다.
          </Text>
          <TextInput
            style={styles.reflectInput}
            value={reflectRequest}
            onChangeText={setReflectRequest}
            placeholder="예: 점심은 비빔밥, 오후는 여유롭게, 비 오면 실내 위주"
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={800}
            editable={!rerouting}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.reflectBtn, rerouting && { opacity: 0.6 }]}
            disabled={rerouting}
            onPress={() => void runReflectRequest()}
            accessibilityRole="button"
            accessibilityLabel="여행 재계획"
          >
            {rerouting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.reflectBtnText}>여행 재계획</Text>
            )}
          </Pressable>
        </>
      ) : null}
      <Text style={[styles.sectionLabel, { color: colors.text }]}>필터</Text>
      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.chip, catFilter === f.id && styles.chipOn]}
            onPress={() => setCatFilter(f.id)}
          >
            <Text
              style={[
                styles.chipText,
                catFilter === f.id && styles.chipTextOn,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const listHeader = (
    <View>
      <View style={styles.listHeaderTop}>
        <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
          <Text style={[styles.back, { color: colors.accent }]}>← 목록</Text>
        </Pressable>

        <View style={styles.modeToggleRow}>
          {(
            [
              { id: "easy" as const, label: "쉽게" },
              { id: "detailed" as const, label: "자세히" },
            ] as const
          ).map((opt) => {
            const on = planUiMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                  },
                ]}
                onPress={() => setUiMode(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`표시 ${opt.label}`}
              >
                <Text
                  style={{
                    color: on ? colors.chipOnFg : colors.chipFg,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {tripCitiesLabel(trip)} {trip.nights}박 {trip.days}일
        </Text>
        <Text style={styles.sub}>
          {trip.partySize}명 · 계획 {money(trip.plannedBudget)} ·{" "}
          {STATUS_LABEL[trip.status] ?? trip.status}
        </Text>

        <Pressable
          style={styles.moreBtn}
          onPress={() => setSettingsOpen((v) => !v)}
        >
          <Text style={styles.moreBtnText}>
            {settingsOpen ? "▾ 여행 설정" : "⋯ 여행 설정"}
          </Text>
        </Pressable>
        {settingsOpen ? (
          <View style={styles.settingsBox}>
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
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textOnCard, marginTop: 10 },
            ]}
          >
            여행 시작 시간
          </Text>
          <Text
            style={[styles.settingsHint, { color: colors.textMutedOnCard }]}
          >
            매일 일정의 시작 기준 시각입니다. (기본 09:00)
          </Text>
          <Pressable
            style={styles.addCityBtn}
            onPress={() => setStartTimeEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="여행 시작 시간 설정"
          >
            <Text style={styles.addCityBtnText}>시작 {tripStartTime}</Text>
          </Pressable>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textOnCard, marginTop: 10 },
            ]}
          >
            숙소 복귀 시간
          </Text>
          <Text
            style={[styles.settingsHint, { color: colors.textMutedOnCard }]}
          >
            하루 일정을 이 시각까지 맞춰 숙소로 돌아옵니다. (기본 21:00)
          </Text>
          <Pressable
            style={styles.addCityBtn}
            onPress={() => setReturnTimeEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="숙소 복귀 시간 설정"
          >
            <Text style={styles.addCityBtnText}>
              복귀 {lodgingReturnTime}
            </Text>
          </Pressable>
          {canPickDomesticCities ? (
            <View style={styles.easyExtras}>
              <Text style={[styles.sectionLabel, { color: colors.textOnCard }]}>
                여행지 (도 · 도시)
              </Text>
              <Text
                style={[styles.settingsHint, { color: colors.textMutedOnCard }]}
              >
                계획 단계에서 도와 도시를 고르면 Day 배정에 반영됩니다.
              </Text>
              <View style={styles.tabs}>
                {existingCityIds.map((cid) => (
                  <View
                    key={cid}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.chipOnBg },
                    ]}
                  >
                    <Text
                      style={[styles.chipText, { color: colors.chipOnFg }]}
                    >
                      {CITIES[cid]?.nameKo ?? cid}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={styles.addCityBtn}
                onPress={() => setCityPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="도 도시 선택"
              >
                <Text style={styles.addCityBtnText}>
                  도 · 도시 선택 (최대 {MAX_SELECTED_CITIES})
                </Text>
              </Pressable>
              {isMultiCity || existingCityIds.length > 0 ? (
                <>
                  <Text
                    style={[
                      styles.sectionLabel,
                      { color: colors.textOnCard, marginTop: 10 },
                    ]}
                  >
                    Day {day + 1} 도시 배정
                  </Text>
                  <View style={styles.tabs}>
                    {existingCityIds.map((cid) => {
                      const on = dayCityId === cid;
                      return (
                        <Pressable
                          key={cid}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: on
                                ? colors.chipOnBg
                                : colors.chipBg,
                            },
                          ]}
                          onPress={() => promptAssignDayCity(cid)}
                          accessibilityRole="button"
                          accessibilityLabel={`Day ${day + 1}을 ${CITIES[cid].nameKo}로 배정`}
                          accessibilityState={{ selected: on }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: on ? colors.chipOnFg : colors.chipFg,
                              },
                            ]}
                          >
                            {CITIES[cid].nameKo}
                            {on ? " ✓" : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          ) : cityPool.find((id) => !existingCityIds.includes(id)) ? (
            <Pressable
              style={styles.addCityBtn}
              onPress={() => {
                const next = cityPool.find(
                  (id) => !existingCityIds.includes(id),
                );
                if (next) addSecondaryCity(next);
              }}
            >
              <Text style={styles.addCityBtnText}>
                도시 추가 ·{" "}
                {
                  CITIES[
                    cityPool.find((id) => !existingCityIds.includes(id))!
                  ].nameKo
                }
              </Text>
            </Pressable>
          ) : null}
          </View>
        ) : null}
      </View>

      {!isEasy ? <WeatherCrowdChip cityId={dayCityId} /> : null}
      {enriching ? (
        <View style={styles.enrichBar}>
          <ActivityIndicator size="small" color="#0369a1" />
          <Text style={styles.enrichText}>교통 재계산 중…</Text>
        </View>
      ) : null}
      {inlineMsg ? <InlineToast message={inlineMsg} /> : null}

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
              runLayoutAnim();
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
              runLayoutAnim();
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

      <View style={styles.mapPane}>
        <PlanDayMap
          cityId={dayCityId}
          places={mapPlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          onMoveInDay={movePlaceInDay}
          onReorderDay={reorderDayByIds}
          onOpenMap={() => onMap(day)}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Day 선택</Text>
      <View style={styles.tabs}>
        {days.map((d) => (
          <Pressable
            key={d}
            style={[
              styles.tab,
              day === d && [styles.tabOn, { backgroundColor: colors.chipOnBg }],
            ]}
            onPress={() => {
              runLayoutAnim();
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
              <Text
                style={[
                  styles.tabCityHint,
                  { color: day === d ? colors.chipOnFg : colors.textMuted },
                ]}
              >
                {CITIES[cityIdForDay(trip, d)].nameKo}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {isMultiCity && !isEasy ? (
        <FadeIn trigger={`day-city-${day}-${dayCityId}`}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Day {day + 1} 도시 배정
          </Text>
          <View style={styles.tabs}>
            {(
              (trip.cities?.map((c) => c.cityId) ?? [
                trip.cityId,
              ]) as MvpCityId[]
            ).map((cid) => {
              const on = dayCityId === cid;
              return (
                <Pressable
                  key={cid}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                    },
                  ]}
                  onPress={() => promptAssignDayCity(cid)}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${day + 1}을 ${CITIES[cid].nameKo}로 배정`}
                  accessibilityHint="지도 중심과 dayIndexes가 갱신됩니다"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: on ? colors.chipOnFg : colors.chipFg },
                    ]}
                  >
                    {CITIES[cid].nameKo}
                    {on ? " ✓" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FadeIn>
      ) : null}

      {filterAndInsertBlock}

      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        Day {day + 1} 일정 ({dayPlaces.length})
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {isFieldMode ? (
        <View
          style={[
            styles.fieldRoot,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.fieldHeader}>
            <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
              <Text style={[styles.back, { color: colors.accent }]}>← 목록</Text>
            </Pressable>
            <View style={styles.fieldHeaderCenter}>
              <Text
                style={[styles.fieldHeaderTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {tripCitiesLabel(trip)} · 현장
              </Text>
              <Text style={[styles.fieldHeaderSub, { color: colors.textMuted }]}>
                Day {day + 1} · 다음 장소만 집중
              </Text>
            </View>
            <Pressable
              style={styles.fieldEndHit}
              onPress={endTrip}
              accessibilityRole="button"
              accessibilityLabel="여행 종료"
            >
              <Text style={[styles.fieldEndText, { color: colors.textMuted }]}>
                종료
              </Text>
            </Pressable>
          </View>

          {inlineMsg ? <InlineToast message={inlineMsg} /> : null}
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

          <View style={styles.fieldDayRow}>
            {days.map((d) => {
              const on = day === d;
              return (
                <Pressable
                  key={d}
                  style={[
                    styles.fieldDayChip,
                    {
                      backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                    },
                  ]}
                  onPress={() => {
                    runLayoutAnim();
                    setDay(d);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Day ${d + 1}`}
                >
                  <Text
                    style={[
                      styles.fieldDayChipText,
                      { color: on ? colors.chipOnFg : colors.chipFg },
                    ]}
                  >
                    D{d + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldMap}>
            <PlanDayMap
              cityId={dayCityId}
              places={mapPlaces}
              selectedPlaceId={nextAction?.place.id ?? selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              onMoveInDay={movePlaceInDay}
              onReorderDay={reorderDayByIds}
              onOpenMap={() => onMap(day)}
            />
          </View>

          <View style={styles.fieldBottomSheet}>
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
          </View>
        </View>
      ) : (
        <View style={styles.listRoot}>
          <DraggableFlatList
            data={dayPlaces}
            keyExtractor={(item) => item.id}
            onDragBegin={() => setListDragging(true)}
            onDragEnd={({ data }) => {
              setListDragging(false);
              reorder(data);
            }}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            activationDistance={16}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            }}
            ListEmptyComponent={
              <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
                <EmptyState
                  glyph="＋"
                  title="이 날 일정이 비어 있습니다"
                  body={
                    isEasy
                      ? "「자세히」로 전환한 뒤 +맛집 · +관광으로 장소를 추가하거나, 다른 Day에서 Day▶로 옮겨 오세요."
                      : "위에서 +맛집 · +관광 · +숙소로 장소를 추가하거나, 다른 Day에서 Day▶로 옮겨 오세요."
                  }
                />
              </View>
            }
          />
        </View>
      )}

      {undoVisible ? (
        <Animated.View
          style={[
            styles.undoBar,
            {
              backgroundColor: colors.undoBg,
              opacity: undoOpacity,
              transform: [
                {
                  translateY: undoOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
          accessibilityRole="summary"
          accessibilityLabel="일정 변경 실행 취소"
        >
          <Text style={[styles.undoLabel, { color: colors.undoFg }]}>
            {undoDepth > 1
              ? `변경됨 · 되돌리기 ${undoDepth}단계`
              : "일정이 변경되었습니다"}
          </Text>
          <Pressable
            onPress={undoLastChange}
            accessibilityRole="button"
            accessibilityLabel="실행 취소"
            accessibilityHint="최근 순서·삭제·이동을 되돌립니다"
          >
            <Text style={{ color: colors.undoFg, fontWeight: "800", fontSize: 13 }}>
              실행 취소{undoDepth > 1 ? ` (${undoDepth})` : ""}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {!isFieldMode ? (
        <View style={{ paddingBottom: Math.max(insets.bottom, space.sm) }}>
          {!isEasy ? (
            <>
              <Text
                style={[styles.footerCatLabel, { color: colors.textMuted }]}
              >
                보기 · 기록
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => onMap(day)}
                  accessibilityRole="button"
                  accessibilityLabel="전체지도"
                >
                  <Text style={styles.btnGhostText}>전체지도</Text>
                </Pressable>
                <Pressable
                  style={styles.btn}
                  onPress={onExpenses}
                  accessibilityRole="button"
                  accessibilityLabel="경비"
                >
                  <Text style={styles.btnText}>경비</Text>
                </Pressable>
                <Pressable
                  style={styles.btn}
                  onPress={onSummary}
                  accessibilityRole="button"
                  accessibilityLabel="요약"
                >
                  <Text style={styles.btnText}>요약</Text>
                </Pressable>
                <Pressable
                  style={styles.btnGhost}
                  onPress={onCapture}
                  accessibilityRole="button"
                  accessibilityLabel="리뷰"
                >
                  <Text style={styles.btnGhostText}>리뷰</Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.footerCatLabel,
                  { color: colors.textMuted, marginTop: 10 },
                ]}
              >
                여행
              </Text>
              <View style={styles.actions}>
                {trip.status !== "active" ? (
                  <Pressable
                    style={styles.btnAlt}
                    onPress={() => setStatus("active")}
                    accessibilityRole="button"
                    accessibilityLabel="여행 시작"
                  >
                    <Text style={styles.btnAltText}>여행 시작</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.btnAlt}
                    onPress={() => {
                      setViewMode("field");
                      setBannerHidden(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="현장 모드"
                  >
                    <Text style={styles.btnAltText}>현장 모드</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.btnAlt, rerouting && { opacity: 0.6 }]}
                  disabled={rerouting}
                  onPress={() =>
                    void runReroute(
                      "사용자가 동선에서 벗어남 / 남은 일정 재조정",
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="이탈 재루트"
                >
                  {rerouting ? (
                    <ActivityIndicator color="#075985" />
                  ) : (
                    <Text style={styles.btnAltText}>이탈·재루트</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.btnAlt}
                  onPress={endTrip}
                  accessibilityRole="button"
                  accessibilityLabel="여행 종료"
                >
                  <Text style={styles.btnAltText}>여행 종료</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              {trip.status !== "active" ? (
                <Pressable
                  style={styles.btnAlt}
                  onPress={() => setStatus("active")}
                  accessibilityRole="button"
                  accessibilityLabel="여행 시작"
                >
                  <Text style={styles.btnAltText}>여행 시작</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.btnAlt}
                  onPress={() => {
                    setViewMode("field");
                    setBannerHidden(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="현장 모드"
                >
                  <Text style={styles.btnAltText}>현장 모드</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.btnAlt}
                onPress={endTrip}
                accessibilityRole="button"
                accessibilityLabel="여행 종료"
              >
                <Text style={styles.btnAltText}>여행 종료</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      <TransportCompareSheet
        visible={comparePlace != null}
        placeName={comparePlace?.name ?? ""}
        options={compareOptions}
        selectedMode={comparePlace?.preferredTransportMode}
        loading={compareLoading}
        engineHint={compareEngine}
        currency={currencyForCity(trip.cityId)}
        onSelect={applyTransportMode}
        onClose={() => setComparePlace(null)}
        onOpenNaverTransit={
          comparePlace && isDomesticCityId(dayCityId)
            ? () => {
                const { dest, origin, transitOpt } =
                  resolveNavEndpoints(comparePlace);
                void openTransitDeepLink(
                  "naver",
                  dest,
                  origin,
                  transitOpt?.deepLinks ??
                    compareOptions.find((o) => o.mode === "transit")?.deepLinks,
                  "public",
                ).catch((e) => {
                  Alert.alert(
                    "길안내 실패",
                    e instanceof Error
                      ? e.message
                      : "네이버 지도를 열 수 없습니다.",
                  );
                });
              }
            : undefined
        }
        onOpenMapsTransit={
          comparePlace
            ? () => {
                const { dest, origin, transitOpt } =
                  resolveNavEndpoints(comparePlace);
                void openTransitDeepLink(
                  "google",
                  dest,
                  origin,
                  transitOpt?.deepLinks ??
                    compareOptions.find((o) => o.mode === "transit")?.deepLinks,
                ).catch((e) => {
                  Alert.alert(
                    "길안내 실패",
                    e instanceof Error ? e.message : "지도를 열 수 없습니다.",
                  );
                });
              }
            : undefined
        }
        onOpenYahooTransit={
          comparePlace && !isDomesticCityId(dayCityId)
            ? () => {
                const { dest, origin, transitOpt } =
                  resolveNavEndpoints(comparePlace);
                void openTransitDeepLink(
                  "yahoo",
                  dest,
                  origin,
                  transitOpt?.deepLinks ??
                    compareOptions.find((o) => o.mode === "transit")?.deepLinks,
                ).catch((e) => {
                  Alert.alert(
                    "길안내 실패",
                    e instanceof Error
                      ? e.message
                      : "Yahoo 환승을 열 수 없습니다.",
                  );
                });
              }
            : undefined
        }
      />

      <Modal
        visible={domesticNavPlace != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDomesticNavPlace(null)}
      >
        <Pressable
          style={styles.navigationBackdrop}
          onPress={() => setDomesticNavPlace(null)}
        >
          <Pressable
            style={styles.navigationSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.navigationHandle} />
            <Text style={styles.navigationTitle}>길안내 앱 선택</Text>
            <Text style={styles.navigationSub} numberOfLines={1}>
              → {domesticNavPlace?.name}
            </Text>
            <Text style={styles.navigationHint}>
              사용할 지도 앱을 선택한 뒤 길안내를 열어주세요.
            </Text>
            {[
              { id: "naver" as const, label: "네이버 지도" },
              { id: "google" as const, label: "Google 지도" },
            ].map((app) => {
              const selected = domesticNavApp === app.id;
              return (
                <Pressable
                  key={app.id}
                  style={[
                    styles.navigationOption,
                    selected && styles.navigationOptionSelected,
                  ]}
                  onPress={() => setDomesticNavApp(app.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${app.label}${selected ? " 선택됨" : ""}`}
                >
                  <View
                    style={[
                      styles.navigationRadio,
                      selected && styles.navigationRadioSelected,
                    ]}
                  >
                    {selected ? <View style={styles.navigationRadioDot} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.navigationOptionText,
                      selected && styles.navigationOptionTextSelected,
                    ]}
                  >
                    {app.label}
                  </Text>
                  {app.id === "naver" ? (
                    <Text style={styles.navigationDefault}>기본</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              style={styles.navigationOpenButton}
              onPress={openSelectedDomesticNavigation}
              accessibilityRole="button"
              accessibilityLabel={`${domesticNavApp === "naver" ? "네이버 지도" : "Google 지도"}로 길안내 열기`}
            >
              <Text style={styles.navigationOpenButtonText}>길안내 열기</Text>
            </Pressable>
            <Pressable
              style={styles.navigationCancelButton}
              onPress={() => setDomesticNavPlace(null)}
              accessibilityRole="button"
              accessibilityLabel="길안내 앱 선택 닫기"
            >
              <Text style={styles.navigationCancelButtonText}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={completionBriefingVisible}
        transparent
        animationType="fade"
        onRequestClose={onTripEnded}
      >
        <View style={styles.completionBackdrop}>
          <View
            style={[
              styles.completionCard,
              { backgroundColor: colors.bgElevated },
            ]}
          >
            <Text style={[styles.completionTitle, { color: colors.text }]}>
              여행 완료
            </Text>
            <Text
              style={[styles.completionDestination, { color: colors.accent }]}
            >
              {tripCitiesLabel(trip)}
            </Text>
            <Text
              style={[styles.completionMeta, { color: colors.textSecondary }]}
            >
              {trip.nights}박 {trip.days}일 · 장소 {trip.places.length}곳
            </Text>
            <Text
              style={[styles.completionMeta, { color: colors.textSecondary }]}
            >
              계획 예산 {money(trip.plannedBudget)}
            </Text>
            <Text style={[styles.completionMessage, { color: colors.text }]}>
              수고하셨어요. 이번 여행의 추억을 다이어리에 남겨보세요.
            </Text>
            <Pressable
              style={[
                styles.completionButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={onTripEnded}
              accessibilityRole="button"
              accessibilityLabel="홈으로 이동"
            >
              <Text
                style={[
                  styles.completionButtonText,
                  { color: colors.primaryFg },
                ]}
              >
                확인
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PlaceSuggestModal
        visible={suggestVisible}
        category={suggestCategory}
        categoryLabel={CATEGORY_LABEL[suggestCategory] || suggestCategory}
        places={suggestList}
        aiRouteNames={trip.places
          .filter((p) => p.dayIndex === day)
          .map((p) => p.name)}
        cityId={dayCityId}
        source={suggestSource}
        loading={suggesting}
        onConfirm={(picks) => void confirmSuggested(picks)}
        onClose={() => setSuggestVisible(false)}
      />

      <ProvinceCityPickerModal
        visible={cityPickerOpen}
        initialCityIds={existingCityIds}
        title="여행지 도 · 도시 선택"
        onConfirm={applyProvinceCities}
        onClose={() => setCityPickerOpen(false)}
      />

      <PlannedTimeModal
        visible={timeEditPlace != null}
        placeName={timeEditPlace?.name ?? ""}
        initialTime={timeEditPlace?.plannedTime || "09:00"}
        onSave={savePlannedTime}
        onClose={() => setTimeEditPlace(null)}
      />

      <PlannedTimeModal
        visible={startTimeEditOpen}
        title="여행 시작 시간"
        placeName="매일 일정 시작 기준"
        initialTime={tripStartTime}
        onSave={saveTripStartTime}
        onClose={() => setStartTimeEditOpen(false)}
      />

      <PlannedTimeModal
        visible={returnTimeEditOpen}
        title="숙소 복귀 시간"
        placeName="하루 일정 종료 · 숙소 도착 목표"
        initialTime={lodgingReturnTime}
        onSave={saveLodgingReturnTime}
        onClose={() => setReturnTimeEditOpen(false)}
      />

      <PlanCoachmark
        visible={planCoachVisible}
        onDismiss={dismissPlanCoach}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  completionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    justifyContent: "center",
    padding: 24,
  },
  completionCard: { borderRadius: 20, padding: 24 },
  completionTitle: { fontSize: 24, fontWeight: "800" },
  completionDestination: { marginTop: 12, fontSize: 18, fontWeight: "800" },
  completionMeta: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  completionMessage: { marginTop: 20, fontSize: 15, lineHeight: 23 },
  completionButton: {
    minHeight: 52,
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  completionButtonText: { fontSize: 16, fontWeight: "800" },
  listRoot: { flex: 1 },
  listHeaderTop: { paddingHorizontal: 12 },
  gestureHintBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,23,42,0.12)",
  },
  gestureHintText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  modeChip: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  easyExtras: { marginTop: 8 },
  backHit: {
    alignSelf: "flex-start",
    minHeight: TOUCH_MIN,
    justifyContent: "center",
    marginBottom: 4,
  },
  back: { color: "#0369a1", fontWeight: "700", fontSize: 15 },
  title: { fontSize: 20, fontWeight: "800", color: "#0c4a6e" },
  sub: { color: "#64748b", marginTop: 2 },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
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
  settingsHint: { fontSize: 11, color: "#64748b", marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  timeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: TOUCH_MIN,
    minWidth: TOUCH_MIN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: { fontSize: 13, fontWeight: "800" },
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
  reflectInput: {
    minHeight: 72,
    maxHeight: 120,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 13,
    color: "#0f172a",
    lineHeight: 18,
  },
  reflectToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: TOUCH_MIN,
    marginTop: 2,
    marginBottom: 4,
  },
  reflectCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  reflectCheckboxOn: {
    borderColor: "#0c4a6e",
    backgroundColor: "#0c4a6e",
  },
  reflectCheckmark: { color: "#fff", fontSize: 14, fontWeight: "900" },
  reflectBtn: {
    marginBottom: 10,
    paddingVertical: 12,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    backgroundColor: "#0c4a6e",
    alignItems: "center",
    justifyContent: "center",
  },
  reflectBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  fieldRoot: { flex: 1, paddingHorizontal: 4 },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    minHeight: TOUCH_MIN,
  },
  fieldHeaderCenter: { flex: 1, minWidth: 0 },
  fieldHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  fieldHeaderSub: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  fieldEndHit: {
    minHeight: TOUCH_MIN,
    minWidth: TOUCH_MIN,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  fieldEndText: { fontSize: 13, fontWeight: "800" },
  fieldDayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 6,
  },
  fieldDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 10,
    justifyContent: "center",
  },
  fieldDayChipText: { fontSize: 13, fontWeight: "800" },
  fieldMap: { flex: 1, minHeight: 160, marginHorizontal: 4, borderRadius: 12, overflow: "hidden" },
  fieldBottomSheet: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
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
  mapNoBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  mapNoBadgeText: { fontSize: 13, fontWeight: "900" },
  name: { flex: 1, fontWeight: "700", color: "#0f172a", fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  estimateHint: { marginTop: 2, fontSize: 11, color: "#94a3b8" },
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
  navigationBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  navigationSheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#fff",
  },
  navigationHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  navigationTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  navigationSub: { marginTop: 4, fontSize: 13, color: "#64748b" },
  navigationHint: { marginTop: 8, fontSize: 12, color: "#64748b" },
  navigationOption: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TOUCH_MIN,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  navigationOptionSelected: {
    borderColor: "#0284c7",
    backgroundColor: "#e0f2fe",
  },
  navigationRadio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 10,
    borderColor: "#94a3b8",
  },
  navigationRadioSelected: { borderColor: "#0284c7" },
  navigationRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0284c7",
  },
  navigationOptionText: {
    marginLeft: 10,
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  navigationOptionTextSelected: { color: "#075985" },
  navigationDefault: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#bae6fd",
    color: "#075985",
    fontSize: 11,
    fontWeight: "800",
  },
  navigationOpenButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#0c4a6e",
  },
  navigationOpenButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  navigationCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  navigationCancelButtonText: { color: "#334155", fontWeight: "700" },
  footerCatLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
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
