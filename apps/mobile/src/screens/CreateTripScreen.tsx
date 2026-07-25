import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProvinceCityPicker } from "../components/ProvinceCityPicker";
import {
  CITIES,
  DEPARTURE_CITY_IDS,
  MAX_SELECTED_CITIES,
} from "../data/destinations";
import type { MvpCityId, OutboundTransportMode } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

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
  partySize: number;
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime: string;
  /** 출발지 → 첫 여행지 이동수단 */
  outboundTransportMode: OutboundTransportMode;
  userRequest?: string;
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
    useState<DepartureCityId>("seoul");
  // 여행지는 기본 미선택 — 사용자가 직접 고름
  const [selected, setSelected] = useState<MvpCityId[]>([]);
  const [nights, setNights] = useState(2);
  const [days, setDays] = useState(3);
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
    e: NativeSyntheticEvent<TextInputFocusEventData>,
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

  const changeNights = (n: number) => {
    const next = clamp(n, 0, 14);
    setNights(next);
    // 박수 변경 시 일수를 최소 박수+1로 맞춤 (당일치기 0박 1일)
    setDays((d) => Math.max(d, next + 1));
  };

  const changeDays = (d: number) => {
    const next = clamp(d, 1, 15);
    setDays(next);
    // 일수가 박수보다 작아지지 않게 (nights <= days-1)
    setNights((n) => Math.min(n, Math.max(0, next - 1)));
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
    const n = clamp(nights, 0, 14);
    const d = clamp(Math.max(days, n + 1), 1, 15);
    const p = clamp(party, 1, 12);
    const cityIds = selected;
    const dep = CITIES[departureCityId];
    const addr = startAddress.trim();
    onSubmit({
      cityId: cityIds[0],
      cityIds,
      departureCityId,
      nights: n,
      days: d,
      partySize: p,
      startAddress: addr || dep?.nameKo,
      startLat: startLat ?? dep?.center.lat,
      startLng: startLng ?? dep?.center.lng,
      startTime: normalizeStartTime(startTime),
      outboundTransportMode,
      userRequest: userRequest.trim() || undefined,
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
          placeholder={`예: ${CITIES[departureCityId].nameKo}시 …`}
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
          여행지 (도 → 도시)
        </Text>
        <ProvinceCityPicker
          selectedCityIds={selected}
          onChangeCityIds={(ids) => setSelected(ids as MvpCityId[])}
          maxCities={MAX_SELECTED_CITIES}
        />

        <View style={styles.fieldGrid}>
          <NumberStepper
            label="박수"
            value={nights}
            min={0}
            max={14}
            unit="박"
            onChange={changeNights}
            colors={stepperColors}
          />
          <NumberStepper
            label="일수"
            value={days}
            min={1}
            max={15}
            unit="일"
            onChange={changeDays}
            colors={stepperColors}
          />
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
});
