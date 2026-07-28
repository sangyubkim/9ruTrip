import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FocusEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  searchPlaces,
  type PlaceSearchResult,
} from "../api/trip";
import type { ItineraryPlace, PlaceCategory } from "../types";
import {
  CATEGORY_LABEL,
  currencyForCity,
  formatHotelBreakfastLabel,
  formatHotelNightlyMoney,
  formatPlaceMoney,
} from "../utils/cost";
import { formatDistanceKm, haversineKm } from "../utils/geo";
import { getDeviceCoords, isDeviceLocationAvailable } from "../utils/deviceLocation";
import {
  estimateLodgingBreakdown,
  formatLodgingScoreLines,
  lodgingTipFromBreakdown,
} from "../utils/lodgingExplain";
import { placeDetailLines } from "../utils/placeDetails";
import { openNaverSearch } from "../utils/naverSearch";
import {
  findDuplicatePlace,
  isSamePlace,
  namesSimilar,
} from "../utils/placeMatch";
import { CITIES } from "../types";

type CenterMode = "gps" | "custom" | "anchor";

type SearchCenter = {
  lat: number;
  lng: number;
  label: string;
  nearQuery?: string;
  mode: CenterMode;
};

/** 검색 중심(앞 일정·위치 지정)과 실질적으로 같은 장소면 후보에서 제외 */
const ANCHOR_EXCLUDE_KM = 0.08; // ~80m

type Props = {
  visible: boolean;
  category: PlaceCategory;
  categoryLabel: string;
  places: ItineraryPlace[];
  /** 이미 AI 추천 경로에 들어간 장소명 (체크+AI 표시) — 「일정에 있음」과 별개 */
  aiRouteNames?: string[];
  /** 현재 Day 일정 장소 — 「일정에 있음」뱃지용 */
  dayPlaces?: ItineraryPlace[];
  cityId?: string;
  source?: string;
  loading?: boolean;
  /** + 삽입점 앞 경로(또는 폴백) 좌표 — 「앞 일정 주변」검색용 */
  anchorPlace?: { lat: number; lng: number; name: string } | null;
  /** 기준 좌표가 정해지면 카테고리 후보 재조회 */
  onRequestSuggest: (center: {
    lat: number;
    lng: number;
    nearQuery?: string;
  }) => void;
  onConfirm: (places: ItineraryPlace[]) => void;
  onClose: () => void;
};

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function isSearchCenterItself(
  place: ItineraryPlace,
  ref: { lat: number; lng: number; name: string },
): boolean {
  if (isSamePlace(place, ref)) return true;
  if (
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng) ||
    !namesSimilar(place.name, ref.name)
  ) {
    return false;
  }
  return (
    haversineKm(
      { lat: place.lat, lng: place.lng },
      { lat: ref.lat, lng: ref.lng },
    ) <= ANCHOR_EXCLUDE_KM
  );
}

export function PlaceSuggestModal({
  visible,
  category,
  categoryLabel,
  places,
  aiRouteNames = [],
  dayPlaces = [],
  cityId = "seoul",
  source,
  loading,
  anchorPlace = null,
  onRequestSuggest,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const currency = currencyForCity(cityId);
  const isHotel = category === "hotel";
  const isFood = category === "food";
  const aiSet = useMemo(
    () => new Set(aiRouteNames.map(normName)),
    [aiRouteNames],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [centerMode, setCenterMode] = useState<CenterMode | null>(null);
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [gpsStatus, setGpsStatus] = useState<
    "idle" | "loading" | "ok" | "fail"
  >("idle");
  const [gpsError, setGpsError] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!visible) {
      setCenterMode(null);
      setCenter(null);
      setGpsStatus("idle");
      setGpsError("");
      setPlaceQuery("");
      setPlaceResults([]);
      setPlaceSearching(false);
      setSelectedIds(new Set());
      setKeyboardHeight(0);
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  /** ManualPlaceModal과 동일: 포커스된 필드를 키보드 위로 스크롤 */
  const scrollFocusedIntoView = (e: FocusEvent) => {
    const target = e?.nativeEvent?.target;
    setTimeout(
      () => {
        if (!scrollRef.current || target == null) {
          scrollRef.current?.scrollToEnd({ animated: true });
          return;
        }
        const responder = (
          scrollRef.current as unknown as {
            getScrollResponder?: () => {
              scrollResponderScrollNativeHandleToKeyboard?: (
                node: number,
                offset: number,
                animated: boolean,
              ) => void;
            };
          }
        ).getScrollResponder?.();
        responder?.scrollResponderScrollNativeHandleToKeyboard?.(
          target as unknown as number,
          120,
          true,
        );
      },
      Platform.OS === "ios" ? 280 : 120,
    );
  };

  useEffect(() => {
    if (!visible || !center) return;
    const initial = new Set<string>();
    for (const p of places) {
      if (aiSet.has(normName(p.name))) initial.add(p.id);
    }
    if (isHotel) {
      const firstAi = places.find((p) => aiSet.has(normName(p.name)));
      setSelectedIds(firstAi ? new Set([firstAi.id]) : new Set());
    } else {
      setSelectedIds(initial);
    }
  }, [visible, places, aiSet, isHotel, center]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const distanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!center) return map;
    for (const p of places) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      map.set(
        p.id,
        haversineKm(center, { lat: p.lat, lng: p.lng }),
      );
    }
    return map;
  }, [center, places]);

  /** 앞 일정·위치 지정 기준 장소 자체(~1m)는 후보에서 제외 */
  const displayPlaces = useMemo(() => {
    if (!center) return places;
    const ref =
      center.mode === "anchor" && anchorPlace
        ? {
            lat: anchorPlace.lat,
            lng: anchorPlace.lng,
            name: anchorPlace.name,
          }
        : center.mode === "custom"
          ? { lat: center.lat, lng: center.lng, name: center.label }
          : null;
    if (!ref?.name?.trim()) return places;
    return places.filter((p) => !isSearchCenterItself(p, ref));
  }, [places, center, anchorPlace]);

  const applyCenter = (next: SearchCenter) => {
    setCenter(next);
    setCenterMode(next.mode);
    onRequestSuggest({
      lat: next.lat,
      lng: next.lng,
      nearQuery: next.nearQuery,
    });
  };

  const hasUsableAnchor =
    anchorPlace != null &&
    Number.isFinite(anchorPlace.lat) &&
    Number.isFinite(anchorPlace.lng) &&
    Boolean(anchorPlace.name?.trim());

  const pickGps = async () => {
    setCenterMode("gps");
    setGpsError("");
    if (!isDeviceLocationAvailable()) {
      setGpsStatus("fail");
      setGpsError("이 환경에서는 GPS를 사용할 수 없습니다.");
      return;
    }
    setGpsStatus("loading");
    try {
      const pos = await getDeviceCoords({ timeoutMs: 10_000 });
      setGpsStatus("ok");
      applyCenter({
        lat: pos.lat,
        lng: pos.lng,
        label: "현재 위치",
        mode: "gps",
      });
    } catch (e) {
      setGpsStatus("fail");
      setGpsError(
        e instanceof Error
          ? e.message
          : "현재 위치를 가져오지 못했습니다.",
      );
    }
  };

  const pickAnchor = () => {
    if (!hasUsableAnchor || !anchorPlace) return;
    setGpsError("");
    applyCenter({
      lat: anchorPlace.lat,
      lng: anchorPlace.lng,
      label: anchorPlace.name,
      nearQuery: anchorPlace.name,
      mode: "anchor",
    });
  };

  const runPlaceSearch = (text: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      const id = ++searchSeq.current;
      setPlaceSearching(true);
      void searchPlaces({ query: text.trim(), cityId })
        .then((res) => {
          if (id !== searchSeq.current) return;
          setPlaceResults(res.results);
        })
        .catch(() => {
          if (id !== searchSeq.current) return;
          setPlaceResults([]);
        })
        .finally(() => {
          if (id === searchSeq.current) setPlaceSearching(false);
        });
    }, 350);
  };

  const pickPlace = (r: PlaceSearchResult) => {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGpsError("선택한 장소의 좌표가 없습니다. 다른 결과를 골라 주세요.");
      return;
    }
    setGpsError("");
    setPlaceQuery(r.name);
    setPlaceResults([]);
    applyCenter({
      lat,
      lng,
      label: r.name,
      nearQuery: r.name,
      mode: "custom",
    });
  };

  const resetCenter = () => {
    setCenter(null);
    setCenterMode(null);
    setGpsStatus("idle");
    setGpsError("");
    setPlaceQuery("");
    setPlaceResults([]);
    setSelectedIds(new Set());
  };

  const toggle = (place: ItineraryPlace) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isHotel) {
        return new Set([place.id]);
      }
      if (next.has(place.id)) next.delete(place.id);
      else next.add(place.id);
      return next;
    });
  };

  const confirm = () => {
    const picks = places.filter((p) => selectedIds.has(p.id));
    if (!picks.length) {
      onClose();
      return;
    }
    onConfirm(isHotel ? picks.slice(0, 1) : picks);
  };

  const centerHint = center
    ? center.mode === "gps"
      ? `거리 · ${center.label} 기준`
      : center.mode === "anchor"
        ? `거리 · ${center.label}(앞 일정) 근처`
        : `거리 · ${center.label} 근처`
    : "";

  const showList = Boolean(center);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                // Android Modal은 window resize가 잘 안 먹혀 시트를 키보드 높이만큼 올림
                marginBottom: Platform.OS === "android" ? keyboardHeight : 0,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              bounces={false}
              contentContainerStyle={{
                paddingBottom:
                  keyboardHeight > 0 ? keyboardHeight * 0.15 + 24 : 0,
              }}
            >
              <Text style={styles.title}>{categoryLabel} 후보 선택</Text>
              <Text style={styles.sub}>
                {showList
                  ? isHotel
                    ? "1일 1곳만 선택 · AI 추천 이유를 확인하세요"
                    : source === "places"
                      ? "여러 곳 선택 가능 · Google Places"
                      : source === "tourapi"
                        ? "여러 곳 선택 가능 · TourAPI"
                        : "여러 곳 선택 가능 · 정적 POI"
                  : "검색 기준 위치를 먼저 선택하세요"}
                {centerHint ? ` · ${centerHint}` : ""}
              </Text>
              {showList ? (
                <Text style={styles.hintLine}>
                  체크 = 추가할 장소 선택 · 「일정에 있음」= 이미 이 Day에 포함
                </Text>
              ) : null}

              {!showList ? (
                <View style={styles.centerBlock}>
                  <View style={styles.modeRow}>
                    <Pressable
                      style={[
                        styles.modeBtn,
                        centerMode === "gps" && styles.modeBtnOn,
                      ]}
                      onPress={() => void pickGps()}
                      accessibilityRole="button"
                      accessibilityLabel="현재 위치 기준 검색"
                    >
                      {gpsStatus === "loading" ? (
                        <ActivityIndicator color="#0c4a6e" />
                      ) : (
                        <Text
                          style={[
                            styles.modeBtnText,
                            centerMode === "gps" && styles.modeBtnTextOn,
                          ]}
                        >
                          현재 위치
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modeBtn,
                        centerMode === "custom" && styles.modeBtnOn,
                      ]}
                      onPress={() => {
                        setCenterMode("custom");
                        setGpsError("");
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="위치 지정 검색"
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          centerMode === "custom" && styles.modeBtnTextOn,
                        ]}
                      >
                        위치 지정
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modeBtn,
                        centerMode === "anchor" && styles.modeBtnOn,
                        !hasUsableAnchor && styles.modeBtnDisabled,
                      ]}
                      disabled={!hasUsableAnchor}
                      onPress={pickAnchor}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !hasUsableAnchor }}
                      accessibilityLabel="앞 일정 주변 검색"
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          centerMode === "anchor" && styles.modeBtnTextOn,
                          !hasUsableAnchor && styles.modeBtnTextDisabled,
                        ]}
                      >
                        앞 일정 주변
                      </Text>
                    </Pressable>
                  </View>

                  {!hasUsableAnchor ? (
                    <Text style={styles.hint}>앞 일정에 위치가 없습니다</Text>
                  ) : null}

                  {gpsError ? (
                    <Text style={styles.errorText}>{gpsError}</Text>
                  ) : null}

                  {centerMode === "custom" ? (
                    <View style={styles.searchBlock}>
                      <Text style={styles.searchLabel}>
                        주소·장소명으로 기준 위치 검색
                      </Text>
                      <View style={styles.searchRow}>
                        <TextInput
                          style={styles.searchInput}
                          value={placeQuery}
                          placeholder="예: 강남역, 해운대 해수욕장"
                          placeholderTextColor="#94a3b8"
                          onChangeText={(t) => {
                            setPlaceQuery(t);
                            runPlaceSearch(t);
                          }}
                          onFocus={scrollFocusedIntoView}
                          accessibilityLabel="기준 위치 검색"
                        />
                        {placeSearching ? (
                          <ActivityIndicator size="small" color="#0369a1" />
                        ) : null}
                      </View>
                      {placeResults.length > 0 ? (
                        <ScrollView style={styles.searchList} nestedScrollEnabled>
                          {placeResults.map((r, i) => (
                            <Pressable
                              key={`${r.placeId || r.name}-${i}`}
                              style={styles.searchItem}
                              onPress={() => pickPlace(r)}
                              accessibilityRole="button"
                              accessibilityLabel={`${r.name} 선택`}
                            >
                              <Text style={styles.searchItemTitle}>{r.name}</Text>
                              {r.address ? (
                                <Text style={styles.searchItemSub} numberOfLines={1}>
                                  {r.address}
                                </Text>
                              ) : null}
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : placeQuery.trim().length >= 2 && !placeSearching ? (
                        <Text style={styles.empty}>검색 결과가 없습니다.</Text>
                      ) : null}
                    </View>
                  ) : centerMode === null ? (
                    <Text style={styles.hint}>
                      「현재 위치」「위치 지정」「앞 일정 주변」중 하나를 고른 뒤
                      후보를 불러옵니다.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.centerBadgeRow}>
                    <Text style={styles.centerBadge} numberOfLines={1}>
                      기준 · {center?.label}
                    </Text>
                    <Pressable
                      onPress={resetCenter}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="기준 위치 변경"
                    >
                      <Text style={styles.changeLink}>변경</Text>
                    </Pressable>
                  </View>
                  {loading ? (
                    <ActivityIndicator
                      style={{ marginVertical: 24 }}
                      color="#0369a1"
                    />
                  ) : (
                    <ScrollView style={styles.list} nestedScrollEnabled>
                      {displayPlaces.length === 0 ? (
                        <Text style={styles.empty}>후보가 없습니다.</Text>
                      ) : (
                        displayPlaces.map((p) => {
                          const checked = selectedIds.has(p.id);
                          const inAi = aiSet.has(normName(p.name));
                          const inDay = Boolean(
                            findDuplicatePlace(dayPlaces, p),
                          );
                          const must =
                            p.mustVisit ||
                            (typeof p.rating === "number" && p.rating >= 4.5);
                          const lodgingScored =
                            isHotel && !p.scoreBreakdown
                              ? estimateLodgingBreakdown(p, cityId)
                              : null;
                          const scoreBd =
                            p.scoreBreakdown ?? lodgingScored?.scoreBreakdown;
                          const lodgingScore =
                            p.lodgingScore ?? lodgingScored?.lodgingScore;
                          const reasonLines = formatLodgingScoreLines(scoreBd);
                          const cityNameKo = CITIES[cityId]?.nameKo ?? "";
                          const tipFromApi = (p.aiReason || p.notes || "").trim();
                          const tipLooksAddress =
                            tipFromApi.length >= 16 &&
                            /(시|군|구|로|길|동|특별자치|광역시)/.test(tipFromApi);
                          const tipLooksRating =
                            tipFromApi === (p.reviewSummary || "").trim();
                          const lodgingTip =
                            tipFromApi && !tipLooksAddress && !tipLooksRating
                              ? tipFromApi
                              : lodgingTipFromBreakdown(
                                  scoreBd,
                                  p.rating,
                                  cityNameKo,
                                );
                          const distKm = distanceById.get(p.id);
                          const distLabel =
                            distKm != null ? formatDistanceKm(distKm) : null;
                          const hotelNightly = isHotel
                            ? formatHotelNightlyMoney(p.estimatedCost, currency)
                            : null;
                          const detailLines = placeDetailLines(p, { maxLines: 3 });
                          return (
                            <Pressable
                              key={p.id}
                              style={[styles.row, checked && styles.rowOn]}
                              onPress={() => toggle(p)}
                              accessibilityRole={isHotel ? "radio" : "checkbox"}
                              accessibilityState={{ checked }}
                            >
                              <View style={styles.checkCol}>
                                <View
                                  style={[
                                    isHotel ? styles.radio : styles.checkbox,
                                    checked && styles.checkOn,
                                  ]}
                                >
                                  {checked ? (
                                    <Text style={styles.checkMark}>
                                      {isHotel ? "●" : "✓"}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              <View style={styles.bodyCol}>
                                <View style={styles.nameRow}>
                                  {must ? (
                                    <Text
                                      style={styles.star}
                                      accessibilityLabel="추천"
                                    >
                                      ★
                                    </Text>
                                  ) : null}
                                  <Text style={styles.name}>{p.name}</Text>
                                  {inDay ? (
                                    <View
                                      style={styles.inDayBadge}
                                      accessibilityLabel="일정에 있음"
                                    >
                                      <Text style={styles.inDayBadgeText}>
                                        일정에 있음
                                      </Text>
                                    </View>
                                  ) : null}
                                  {inAi ? (
                                    <View style={styles.aiBadge}>
                                      <Text style={styles.aiBadgeText}>AI</Text>
                                    </View>
                                  ) : null}
                                  {distLabel ? (
                                    <View style={styles.distBadge}>
                                      <Text style={styles.distBadgeText}>
                                        {distLabel}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                {isFood ? (
                                  <>
                                    <Text style={styles.metaStrong}>
                                      대표 메뉴 ·{" "}
                                      {(p.officialMenu || p.signatureFood) &&
                                      !/^(establishment|point of interest|food|restaurant)/i.test(
                                        p.officialMenu || p.signatureFood || "",
                                      )
                                        ? p.officialMenu || p.signatureFood
                                        : "현지 인기 메뉴"}
                                    </Text>
                                    {Number(p.estimatedCost) > 0 ? (
                                      <Text style={styles.metaStrong}>
                                        가격 ·{" "}
                                        {formatPlaceMoney(
                                          p.estimatedCost,
                                          p.category,
                                          currency,
                                        )}
                                      </Text>
                                    ) : null}
                                    {p.reviewSummary || p.rating != null ? (
                                      <Text style={styles.meta}>
                                        {p.reviewSummary ||
                                          (p.rating != null
                                            ? `평점 ${p.rating}`
                                            : "")}
                                      </Text>
                                    ) : null}
                                    {detailLines.map((line) => (
                                      <Text
                                        key={line}
                                        style={styles.meta}
                                        numberOfLines={1}
                                      >
                                        {line}
                                      </Text>
                                    ))}
                                    {p.notes &&
                                    !detailLines.some((l) => l.includes(p.notes!)) ? (
                                      <Text style={styles.meta} numberOfLines={2}>
                                        {p.notes}
                                      </Text>
                                    ) : null}
                                  </>
                                ) : null}
                                {!isFood && !isHotel ? (
                                  <>
                                    {p.reviewSummary || p.rating != null ? (
                                      <Text style={styles.meta}>
                                        {p.reviewSummary ||
                                          (p.rating != null
                                            ? `평점 ${p.rating}`
                                            : "")}
                                      </Text>
                                    ) : null}
                                    {Number(p.estimatedCost) > 0 ? (
                                      <Text style={styles.meta}>
                                        {CATEGORY_LABEL[p.category] || p.category}{" "}
                                        ·{" "}
                                        {formatPlaceMoney(
                                          p.estimatedCost,
                                          p.category,
                                          currency,
                                        )}
                                      </Text>
                                    ) : (
                                      <Text style={styles.meta}>
                                        {CATEGORY_LABEL[p.category] || p.category}
                                      </Text>
                                    )}
                                    {detailLines.map((line) => (
                                      <Text
                                        key={line}
                                        style={styles.meta}
                                        numberOfLines={1}
                                      >
                                        {line}
                                      </Text>
                                    ))}
                                    {p.notes &&
                                    !detailLines.some((l) =>
                                      l.includes(String(p.notes)),
                                    ) ? (
                                      <Text style={styles.meta} numberOfLines={2}>
                                        {p.notes}
                                      </Text>
                                    ) : null}
                                  </>
                                ) : null}
                                {isHotel ? (
                                  <>
                                    {p.reviewSummary || p.rating != null ? (
                                      <Text style={styles.meta}>
                                        {p.reviewSummary ||
                                          (p.rating != null
                                            ? `평점 ${p.rating}`
                                            : "")}
                                      </Text>
                                    ) : null}
                                    <Text style={styles.metaStrong}>
                                      {formatHotelBreakfastLabel(
                                        p.breakfastIncluded,
                                      )}
                                    </Text>
                                    {hotelNightly ? (
                                      <>
                                        <Text style={styles.metaStrong}>
                                          1박 · {hotelNightly}
                                        </Text>
                                        <Text style={styles.estimateHint}>
                                          추정가 · 확정 아님
                                        </Text>
                                      </>
                                    ) : null}
                                    {detailLines.map((line) => (
                                      <Text
                                        key={line}
                                        style={styles.meta}
                                        numberOfLines={1}
                                      >
                                        {line}
                                      </Text>
                                    ))}
                                    <View style={styles.reasonBox}>
                                      <Text style={styles.reasonTitle}>
                                        AI 선택 이유
                                        {lodgingScore
                                          ? ` · ${lodgingScore}점`
                                          : ""}
                                      </Text>
                                      {reasonLines.map((line) => (
                                        <Text key={line} style={styles.reasonLine}>
                                          · {line}
                                        </Text>
                                      ))}
                                      {lodgingTip ? (
                                        <Text style={styles.reasonLine}>
                                          · {lodgingTip}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </>
                                ) : null}
                              </View>
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  void openNaverSearch(p.name);
                                }}
                                style={styles.searchBtn}
                                accessibilityRole="link"
                                accessibilityLabel={`${p.name} 네이버 검색`}
                                hitSlop={6}
                              >
                                <Text style={styles.searchBtnText}>검색</Text>
                              </Pressable>
                            </Pressable>
                          );
                        })
                      )}
                    </ScrollView>
                  )}
                </>
              )}

              <View style={styles.actions}>
                <Pressable style={styles.close} onPress={onClose}>
                  <Text style={styles.closeText}>닫기</Text>
                </Pressable>
                {showList ? (
                  <Pressable
                    style={[
                      styles.confirm,
                      selectedIds.size === 0 && { opacity: 0.5 },
                    ]}
                    disabled={selectedIds.size === 0 || loading}
                    onPress={confirm}
                  >
                    <Text style={styles.confirmText}>
                      {isHotel
                        ? "숙소 선택"
                        : `선택 추가 (${selectedIds.size})`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0c4a6e" },
  sub: { marginTop: 4, fontSize: 12, color: "#64748b", marginBottom: 4 },
  hintLine: {
    marginBottom: 10,
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  centerBlock: { marginBottom: 8 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  modeBtnOn: {
    borderColor: "#0c4a6e",
    backgroundColor: "#e0f2fe",
  },
  modeBtnDisabled: {
    opacity: 0.45,
  },
  modeBtnText: { fontSize: 14, fontWeight: "800", color: "#475569" },
  modeBtnTextOn: { color: "#0c4a6e" },
  modeBtnTextDisabled: { color: "#94a3b8" },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600",
  },
  searchBlock: { marginTop: 12 },
  searchLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: "#f8fafc",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    paddingVertical: 10,
  },
  searchList: { maxHeight: 180, marginTop: 8 },
  searchItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  searchItemTitle: { fontWeight: "700", fontSize: 14, color: "#0f172a" },
  searchItemSub: { marginTop: 2, fontSize: 12, color: "#64748b" },
  centerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  centerBadge: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#0369a1",
  },
  changeLink: { fontSize: 12, fontWeight: "800", color: "#0c4a6e" },
  list: { maxHeight: 420 },
  empty: { color: "#94a3b8", paddingVertical: 20, textAlign: "center" },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowOn: { backgroundColor: "#f0f9ff" },
  checkCol: { paddingTop: 2 },
  searchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  searchBtnText: { color: "#0369a1", fontWeight: "800", fontSize: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: "#0c4a6e",
    borderColor: "#0c4a6e",
  },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  bodyCol: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  star: { color: "#ca8a04", fontWeight: "900", fontSize: 14 },
  name: { fontWeight: "700", color: "#0f172a", fontSize: 15, flexShrink: 1 },
  aiBadge: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: { fontSize: 10, fontWeight: "800", color: "#c2410c" },
  inDayBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inDayBadgeText: { fontSize: 10, fontWeight: "800", color: "#475569" },
  distBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distBadgeText: { fontSize: 11, fontWeight: "800", color: "#047857" },
  meta: { marginTop: 3, fontSize: 12, color: "#64748b" },
  metaStrong: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  estimateHint: { marginTop: 2, fontSize: 11, color: "#94a3b8" },
  reasonBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 2,
  },
  reasonLine: { fontSize: 11, color: "#c2410c", marginTop: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  close: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  closeText: { fontWeight: "700", color: "#334155" },
  confirm: {
    flex: 1.4,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#0c4a6e",
    justifyContent: "center",
  },
  confirmText: { fontWeight: "800", color: "#fff" },
});
