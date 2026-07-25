import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { DateRangeCalendar } from "../components/DateRangeCalendar";
import { ProvinceCityPicker } from "../components/ProvinceCityPicker";
import {
  CITIES,
  DEPARTURE_CITY_IDS,
  MAX_SELECTED_CITIES,
} from "../data/destinations";
import type { MvpCityId, OutboundTransportMode } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import {
  fetchFestivals,
  type Festival,
  type PreferredFestival,
} from "../api/trip";
import { formatDistanceKm, haversineKm } from "../utils/geo";

const OUTBOUND_TRANSPORT_OPTIONS: {
  id: OutboundTransportMode;
  label: string;
}[] = [
  { id: "car", label: "자차" },
  { id: "train", label: "기차" },
  { id: "bus", label: "버스" },
  { id: "flight", label: "비행기" },
];

let Location: typeof import("expo-location") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require("expo-location");
} catch {
  Location = null;
}

export type DepartureCityId = (typeof DEPARTURE_CITY_IDS)[number];

export type CreateTripInput = {
  cityId: MvpCityId;
  cityIds: MvpCityId[];
  departureCityId: DepartureCityId;
  nights: number;
  days: number;
  startDate: string;
  endDate: string;
  partySize: number;
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime: string;
  /** 출발지 → 첫 여행지 이동수단 */
  outboundTransportMode: OutboundTransportMode;
  userRequest?: string;
  preferredFestivals?: PreferredFestival[];
};

type Props = {
  onBack: () => void;
  onSubmit: (input: CreateTripInput) => void;
  generating?: boolean;
};

function normalizeStartTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "09:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function dateSpan(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const nights = Math.round((end - start) / 86_400_000);
  return { nights, days: nights + 1 };
}

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (n: number) => void;
  colors: {
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    bgElevated: string;
    primary: string;
    primaryFg: string;
    chipBg: string;
  };
};

function NumberStepper({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  colors,
}: StepperProps) {
  return (
    <View style={styles.fieldCol}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.stepper,
          { borderColor: colors.border, backgroundColor: colors.bgElevated },
        ]}
      >
        <Pressable
          style={[
            styles.stepBtn,
            { backgroundColor: colors.chipBg },
            value <= min && { opacity: 0.4 },
          ]}
          disabled={value <= min}
          onPress={() => onChange(clamp(value - 1, min, max))}
          accessibilityRole="button"
          accessibilityLabel={`${label} 감소`}
        >
          <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
        </Pressable>
        <Text
          style={[styles.stepValue, { color: colors.text }]}
          accessibilityLabel={`${label} ${value}${unit || ""}`}
        >
          {value}
          {unit ? (
            <Text style={[styles.stepUnit, { color: colors.textMuted }]}>
              {unit}
            </Text>
          ) : null}
        </Text>
        <Pressable
          style={[
            styles.stepBtn,
            { backgroundColor: colors.primary },
            value >= max && { opacity: 0.4 },
          ]}
          disabled={value >= max}
          onPress={() => onChange(clamp(value + 1, min, max))}
          accessibilityRole="button"
          accessibilityLabel={`${label} 증가`}
        >
          <Text style={[styles.stepBtnText, { color: colors.primaryFg }]}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [departureCityId, setDepartureCityId] =
    useState<DepartureCityId | undefined>();
  // 여행지는 기본 미선택 — 사용자가 직접 고름
  const [selected, setSelected] = useState<MvpCityId[]>([]);
  const [nights, setNights] = useState(2);
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState<string>();
  const [endDate, setEndDate] = useState<string>();
  const [party, setParty] = useState(2);
  const [startAddress, setStartAddress] = useState("");
  const [startLat, setStartLat] = useState<number | undefined>();
  const [startLng, setStartLng] = useState<number | undefined>();
  const [outboundTransportMode, setOutboundTransportMode] =
    useState<OutboundTransportMode>("car");
  const [startTime, setStartTime] = useState("09:00");
  const [userRequest, setUserRequest] = useState("");
  const [locating, setLocating] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedFestivals, setSelectedFestivals] = useState<Festival[]>([]);
  const [festivalVisible, setFestivalVisible] = useState(false);
  const [festivalLoading, setFestivalLoading] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
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
  }, []);

  const scrollFocusedIntoView = (
    e: FocusEvent,
  ) => {
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

  const changeDateRange = (nextStartDate: string, nextEndDate?: string) => {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    if (nextEndDate) {
      const span = dateSpan(nextStartDate, nextEndDate);
      setNights(span.nights);
      setDays(span.days);
    }
  };

  const locationReady = Boolean(
    departureCityId || startAddress.trim() || (startLat != null && startLng != null),
  );
  const datesReady = Boolean(startDate && endDate);

  const applyCitySelection = (nextIds: MvpCityId[], onCancel?: () => void) => {
    const added = nextIds.find((id) => !selected.includes(id));
    if (!added) {
      setSelected(nextIds);
      return;
    }
    if (selected.length >= MAX_SELECTED_CITIES) {
      Alert.alert("여행지 제한", `여행지는 최대 ${MAX_SELECTED_CITIES}곳까지 선택할 수 있습니다.`);
      onCancel?.();
      return;
    }
    const candidate = CITIES[added]?.center;
    const farCity = candidate
      ? selected.find((id) => {
          const existing = CITIES[id]?.center;
          return existing && haversineKm(candidate, existing) > 100;
        })
      : undefined;
    if (!farCity) {
      setSelected(nextIds);
      return;
    }
    Alert.alert(
      "먼 거리 여행지",
      "선택한 도시가 기존 여행지와 100km 이상 떨어져 있습니다. 그래도 추가할까요?",
      [
        { text: "취소", style: "cancel", onPress: onCancel },
        { text: "추가", onPress: () => setSelected(nextIds) },
      ],
    );
  };

  const loadFestivals = async () => {
    if (!startDate || !endDate) return;
    setFestivalLoading(true);
    try {
      setFestivals(
        await fetchFestivals({
          startDate,
          endDate,
          lat: startLat,
          lng: startLng,
          cityId: departureCityId,
        }),
      );
      setFestivalVisible(true);
    } catch (error) {
      Alert.alert(
        "축제 조회 실패",
        error instanceof Error ? error.message : "축제 목록을 불러오지 못했습니다.",
      );
    } finally {
      setFestivalLoading(false);
    }
  };

  const toggleFestival = (festival: Festival) => {
    const exists = selectedFestivals.some((item) => item.id === festival.id);
    if (exists) {
      setSelectedFestivals((items) => items.filter((item) => item.id !== festival.id));
      return;
    }
    setSelectedFestivals((items) => [...items, festival]);
    if (!selected.includes(festival.cityId)) {
      applyCitySelection([...selected, festival.cityId], () => {
        setSelectedFestivals((items) => items.filter((item) => item.id !== festival.id));
      });
    }
  };

  const useCurrentLocation = async () => {
    if (!Location || Platform.OS === "web") {
      Alert.alert("위치 불가", "이 환경에서는 GPS를 사용할 수 없습니다.");
      return;
    }
    setLocating(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") {
          Alert.alert("권한 필요", "현재 위치를 쓰려면 위치 권한이 필요합니다.");
          return;
        }
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.Balanced ?? 3,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setStartLat(lat);
      setStartLng(lng);

      let label = `현재 위치 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      try {
        const geos = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        const g = geos?.[0];
        if (g) {
          const parts = [
            g.region,
            g.city || g.subregion,
            g.district,
            g.street,
            g.name,
          ].filter(Boolean);
          if (parts.length) label = parts.join(" ");
        }
      } catch {
        /* keep coord label */
      }
      setStartAddress(label);
    } catch (e) {
      Alert.alert(
        "위치 실패",
        e instanceof Error ? e.message : "현재 위치를 가져오지 못했습니다.",
      );
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    if (!selected.length) {
      Alert.alert("여행지 필요", "여행 도시를 하나 이상 선택해 주세요.");
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert("여행 날짜 필요", "출발일과 복귀일을 모두 선택해 주세요.");
      return;
    }
    if (!locationReady) {
      Alert.alert("출발지 필요", "출발 도시, 상세 주소 또는 현재 위치를 입력해 주세요.");
      return;
    }
    const { nights: n, days: d } = dateSpan(startDate, endDate);
    const p = clamp(party, 1, 12);
    const cityIds = selected;
    const dep = CITIES[departureCityId ?? "seoul"];
    const addr = startAddress.trim();
    onSubmit({
      cityId: cityIds[0],
      cityIds,
      departureCityId: departureCityId ?? "seoul",
      nights: n,
      days: d,
      startDate,
      endDate,
      partySize: p,
      startAddress: addr || dep?.nameKo,
      startLat: startLat ?? dep?.center.lat,
      startLng: startLng ?? dep?.center.lng,
      startTime: normalizeStartTime(startTime),
      outboundTransportMode,
      userRequest: userRequest.trim() || undefined,
      preferredFestivals: selectedFestivals.map(
        ({ id, name, cityId, startDate: festivalStartDate, endDate: festivalEndDate }) => ({
          id,
          name,
          cityId,
          startDate: festivalStartDate || startDate,
          endDate: festivalEndDate || endDate,
        }),
      ),
    });
  };

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      color: colors.text,
    },
  ];

  const stepperColors = {
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    border: colors.border,
    bgElevated: colors.bgElevated,
    primary: colors.primary,
    primaryFg: colors.primaryFg,
    chipBg: colors.chipBg,
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={{
          paddingBottom:
            Math.max(insets.bottom, 16) +
            24 +
            (keyboardHeight > 0 ? keyboardHeight * 0.35 + 80 : 0),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <Pressable
          onPress={onBack}
          style={styles.backHit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={[styles.back, { color: colors.accent }]}>← 뒤로</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>여행자 정보</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          출발 도시·여행지·일정을 입력하면 AI가 국내 추천 경로를 만듭니다.
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          출발 도시
        </Text>
        <View style={styles.cityRow}>
          {DEPARTURE_CITY_IDS.map((id) => {
            const on = departureCityId === id;
            return (
              <Pressable
                key={id}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                    borderColor: on ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setDepartureCityId(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`출발 ${CITIES[id].nameKo}`}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    { color: on ? colors.chipOnFg : colors.chipFg },
                  ]}
                >
                  {CITIES[id].nameKo}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          출발 상세 주소 (선택)
        </Text>
        <TextInput
          style={inputStyle}
          value={startAddress}
          onChangeText={(t) => {
            setStartAddress(t);
            setStartLat(undefined);
            setStartLng(undefined);
          }}
          onFocus={scrollFocusedIntoView}
          placeholder={`예: ${CITIES[departureCityId ?? "seoul"].nameKo}시 …`}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="출발지 주소"
        />
        <Pressable
          style={[
            styles.gpsBtn,
            { borderColor: colors.accent, backgroundColor: colors.accentMuted },
            locating && { opacity: 0.6 },
          ]}
          onPress={() => void useCurrentLocation()}
          disabled={locating || generating}
          accessibilityRole="button"
          accessibilityLabel="현재 위치로 출발지 입력"
        >
          {locating ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.gpsBtnText, { color: colors.accent }]}>
              현재 위치 (GPS)
            </Text>
          )}
        </Pressable>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          여행 날짜
        </Text>
        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          onChange={changeDateRange}
          colors={stepperColors}
          disabled={!locationReady}
        />
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          {!locationReady
            ? "출발 도시·상세 주소 또는 현재 위치를 먼저 입력해 주세요."
            : startDate && endDate
            ? `${startDate.replaceAll("-", "/")}–${endDate.replaceAll("-", "/")} · ${nights}박 ${days}일`
            : "출발일을 선택한 뒤 복귀일을 선택해 주세요."}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          여행 기간 축제
        </Text>
        <Pressable
          style={[
            styles.gpsBtn,
            { borderColor: colors.accent, backgroundColor: colors.accentMuted },
            (!datesReady || festivalLoading) && { opacity: 0.45 },
          ]}
          onPress={() => void loadFestivals()}
          disabled={!datesReady || festivalLoading}
          accessibilityRole="button"
          accessibilityLabel="여행 기간 축제 목록 보기"
        >
          {festivalLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.gpsBtnText, { color: colors.accent }]}>
              {datesReady ? "여행 기간 축제 보기" : "여행 날짜를 먼저 선택해 주세요"}
            </Text>
          )}
        </Pressable>
        {selectedFestivals.length ? (
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            선택 축제: {selectedFestivals.map((festival) => festival.name).join(" · ")}
          </Text>
        ) : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          여행지 (도 → 도시)
        </Text>
        <ProvinceCityPicker
          selectedCityIds={selected}
          onChangeCityIds={(ids) => applyCitySelection(ids as MvpCityId[])}
          maxCities={MAX_SELECTED_CITIES}
          disabled={!datesReady}
        />
        {!datesReady ? (
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            여행 날짜를 선택하면 여행지 도시를 고를 수 있습니다.
          </Text>
        ) : null}

        <View style={styles.fieldGrid}>
          <NumberStepper
            label="인원"
            value={party}
            min={1}
            max={12}
            unit="명"
            onChange={setParty}
            colors={stepperColors}
          />
        </View>
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          − / + 로 조절 · 0박 1일은 당일치기
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          이동수단
        </Text>
        <View style={styles.cityRow}>
          {OUTBOUND_TRANSPORT_OPTIONS.map((opt) => {
            const on = outboundTransportMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                    borderColor: on ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setOutboundTransportMode(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`이동수단 ${opt.label}`}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    { color: on ? colors.chipOnFg : colors.chipFg },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          출발지 → 첫 여행지 구간의 시간·비용(톨비/교통비) 추정에 사용
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          여행 시작 시간
        </Text>
        <TextInput
          style={inputStyle}
          value={startTime}
          onChangeText={setStartTime}
          onFocus={scrollFocusedIntoView}
          onBlur={() => setStartTime(normalizeStartTime(startTime))}
          placeholder="09:00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="여행 시작 시간"
        />
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          기본 아침 09:00 · HH:mm
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          주요 요청
        </Text>
        <TextInput
          style={[inputStyle, styles.requestInput]}
          value={userRequest}
          onChangeText={setUserRequest}
          onFocus={scrollFocusedIntoView}
          placeholder="예: 아이와 함께, 해산물 위주, 도보 위주…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          accessibilityLabel="주요 요청"
        />
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          AI가 경로 작성에 적극 반영합니다.
        </Text>

        <Pressable
          style={[
            styles.primary,
            { backgroundColor: colors.primary },
            generating && { opacity: 0.6 },
          ]}
          onPress={submit}
          disabled={generating}
          accessibilityRole="button"
          accessibilityLabel="AI 추천 경로 만들기"
        >
          <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
            {generating ? "AI 추천 경로 만드는 중…" : "AI 추천 경로 만들기"}
          </Text>
        </Pressable>
      </ScrollView>
      <Modal
        visible={festivalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFestivalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>여행 기간 국내 축제</Text>
              <Pressable
                onPress={() => setFestivalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="축제 목록 닫기"
              >
                <Text style={[styles.closeText, { color: colors.accent }]}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.festivalList}>
              {festivals.length ? festivals.map((festival) => {
                const on = selectedFestivals.some((item) => item.id === festival.id);
                return (
                  <Pressable
                    key={festival.id}
                    style={[
                      styles.festivalItem,
                      {
                        borderColor: on ? colors.primary : colors.border,
                        backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                      },
                    ]}
                    onPress={() => toggleFestival(festival)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${festival.name} 선택`}
                  >
                    <Text style={[styles.festivalName, { color: on ? colors.chipOnFg : colors.text }]}>
                      {festival.name}
                    </Text>
                    <Text style={[styles.festivalMeta, { color: on ? colors.chipOnFg : colors.textMuted }]}>
                      {festival.cityName}
                      {festival.distanceKm != null ? ` · ${formatDistanceKm(festival.distanceKm)}` : ""}
                    </Text>
                  </Pressable>
                );
              }) : (
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                  선택한 기간과 겹치는 주요 국내 축제가 없습니다.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 2,
  },
  back: { fontSize: 15, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  hint: {
    marginTop: space.sm,
    marginBottom: space.lg,
    fontSize: 14,
    lineHeight: 20,
  },
  label: { marginTop: space.md, fontWeight: "700", fontSize: 13 },
  fieldHint: { marginTop: 4, fontSize: 12 },
  fieldGrid: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
  },
  fieldCol: { flex: 1 },
  stepper: {
    marginTop: space.sm,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  stepBtn: {
    width: 40,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  stepValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  stepUnit: {
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 16,
    fontWeight: "600",
  },
  requestInput: {
    minHeight: 96,
    fontWeight: "500",
    textAlign: "left",
  },
  gpsBtn: {
    marginTop: space.sm,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  gpsBtnText: { fontWeight: "800", fontSize: 14 },
  cityRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
    flexWrap: "wrap",
  },
  cityChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: "center",
    borderWidth: 1.5,
  },
  cityChipText: { fontWeight: "800", fontSize: 15 },
  primary: {
    marginTop: space.xl,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800", fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    maxHeight: "72%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  closeText: { fontSize: 14, fontWeight: "800" },
  festivalList: { gap: space.sm, paddingBottom: space.md },
  festivalItem: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  festivalName: { fontSize: 15, fontWeight: "800" },
  festivalMeta: { marginTop: 4, fontSize: 13, fontWeight: "600" },
});
