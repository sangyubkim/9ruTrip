import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FocusEvent,
} from "react-native";
import { PlaceSearchField } from "../components/PlaceSearchField";
import {
  COUNTRIES,
  DEFAULT_CITY_ID,
  MAX_SELECTED_CITIES,
  citiesInCountry,
  getCountryForCity,
  getDestinationCity,
  type CountryId,
} from "../data/destinations";
import {
  loadRecentCities,
  pushRecentCities,
} from "../storage/recentCitiesStorage";
import {
  DEFAULT_PREFERENCE_WEIGHTS,
  type MvpCityId,
  type PlaceRef,
  type TripPreferenceWeights,
} from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

/** 키보드가 가리지 않도록 포커스된 입력을 ScrollView 가시 영역 안으로 스크롤 */
const FOCUS_SCROLL_MARGIN = 20;
const FOCUS_SCROLL_DELAY_MS = Platform.OS === "ios" ? 60 : 120;

export type CreateTripInput = {
  cityId: MvpCityId;
  cityIds: MvpCityId[];
  nights: number;
  days: number;
  partySize: number;
  origin: PlaceRef | null;
  endPoint: PlaceRef | null;
  stopoverCityIds: MvpCityId[];
  cityWeights: number[];
  preferences: TripPreferenceWeights;
  mainRequest: string;
  extraRequest: string;
};

type Props = {
  onBack: () => void;
  onSubmit: (input: CreateTripInput) => void;
  generating?: boolean;
};

function WeightStepper({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.weightRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.weightLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.weightHint, { color: colors.textMuted }]}>
          {hint}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          style={[styles.stepBtn, { borderColor: colors.border }]}
          onPress={() => onChange(Math.max(1, value - 1))}
          accessibilityLabel={`${label} 감소`}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>−</Text>
        </Pressable>
        <Text style={[styles.stepVal, { color: colors.primary }]}>{value}</Text>
        <Pressable
          style={[styles.stepBtn, { borderColor: colors.border }]}
          onPress={() => onChange(Math.min(5, value + 1))}
          accessibilityLabel={`${label} 증가`}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const lastFocusTargetRef = useRef<FocusEvent["target"] | null>(null);
  const [selected, setSelected] = useState<MvpCityId[]>([DEFAULT_CITY_ID]);
  const [stopovers, setStopovers] = useState<MvpCityId[]>([]);
  const [countryId, setCountryId] = useState<CountryId>(
    getCountryForCity(DEFAULT_CITY_ID)?.id ?? "jp",
  );
  const [recent, setRecent] = useState<MvpCityId[]>([]);
  const [origin, setOrigin] = useState<PlaceRef | null>(null);
  const [endPoint, setEndPoint] = useState<PlaceRef | null>(null);
  const [weightA, setWeightA] = useState(50);
  const [nights, setNights] = useState("2");
  const [days, setDays] = useState("3");
  const [party, setParty] = useState("2");
  const [prefs, setPrefs] = useState<TripPreferenceWeights>({
    ...DEFAULT_PREFERENCE_WEIGHTS,
  });
  const [mainRequest, setMainRequest] = useState("");
  const [extraRequest, setExtraRequest] = useState("");
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadRecentCities().then((ids) => {
      if (cancelled || ids.length === 0) return;
      setRecent(ids);
      setSelected([ids[0]]);
      const country = getCountryForCity(ids[0]);
      if (country) setCountryId(country.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollTargetIntoView = useCallback(
    (target: FocusEvent["target"]) => {
      const scroll = scrollRef.current;
      if (!scroll || !target) return;
      const measurableTarget = target as unknown as View;
      const measurableScroll = scroll as unknown as View;
      measurableTarget.measureInWindow((_x, y, _w, h) => {
        measurableScroll.measureInWindow((_sx, sy, _sw, sh) => {
          const inputBottom = y + h;
          const visibleTop = sy + FOCUS_SCROLL_MARGIN;
          const visibleBottom = sy + sh - FOCUS_SCROLL_MARGIN;
          let delta = 0;
          if (inputBottom > visibleBottom) {
            delta = inputBottom - visibleBottom;
          } else if (y < visibleTop) {
            delta = y - visibleTop;
          }
          if (delta !== 0) {
            scroll.scrollTo({
              y: Math.max(0, scrollYRef.current + delta),
              animated: true,
            });
          }
        });
      });
    },
    [],
  );

  const scrollFocusedIntoView = useCallback(
    (e: FocusEvent) => {
      lastFocusTargetRef.current = e.target;
      setTimeout(
        () => scrollTargetIntoView(e.target),
        FOCUS_SCROLL_DELAY_MS,
      );
    },
    [scrollTargetIntoView],
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => {
      // adjustResize로 뷰포트는 이미 줄어듦 → 하단 필드가 위로 스크롤될 여유만 확보
      setKeyboardPad(Math.min(e.endCoordinates.height * 0.35, 160));
      const target = lastFocusTargetRef.current;
      if (target) {
        setTimeout(() => scrollTargetIntoView(target), FOCUS_SCROLL_DELAY_MS);
      }
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardPad(0);
      lastFocusTargetRef.current = null;
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [scrollTargetIntoView]);

  const countryCities = useMemo(
    () => citiesInCountry(countryId),
    [countryId],
  );

  const weightB = 100 - weightA;
  const cityWeights =
    selected.length > 1 ? [weightA, weightB] : selected.map(() => 100);

  const selectCountry = (id: CountryId) => {
    setCountryId(id);
    const only = citiesInCountry(id);
    if (only.length === 1) {
      setSelected((prev) => {
        if (prev.includes(only[0].id)) return prev;
        if (prev.length >= MAX_SELECTED_CITIES) {
          return [...prev.slice(1), only[0].id];
        }
        return prev.length === 0
          ? [only[0].id]
          : [...prev, only[0].id].slice(0, MAX_SELECTED_CITIES);
      });
    }
  };

  const toggleCity = (id: MvpCityId) => {
    setStopovers((s) => s.filter((x) => x !== id));
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== id);
      }
      if (prev.length >= MAX_SELECTED_CITIES) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
    const country = getCountryForCity(id);
    if (country) setCountryId(country.id);
  };

  const toggleStopover = (id: MvpCityId) => {
    if (selected.includes(id)) return;
    setStopovers((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id].slice(0, 3),
    );
  };

  const submit = async () => {
    const n = Math.min(14, Math.max(1, parseInt(nights, 10) || 2));
    const d = Math.min(15, Math.max(1, parseInt(days, 10) || n + 1));
    const p = Math.min(12, Math.max(1, parseInt(party, 10) || 2));
    const cityIds = selected.length
      ? selected
      : ([DEFAULT_CITY_ID] as MvpCityId[]);
    const nextRecent = await pushRecentCities(cityIds);
    setRecent(nextRecent);
    onSubmit({
      cityId: cityIds[0],
      cityIds,
      nights: n,
      days: d,
      partySize: p,
      origin,
      endPoint,
      stopoverCityIds: stopovers.filter((id) => !cityIds.includes(id)),
      cityWeights:
        cityIds.length > 1 ? [weightA, weightB] : cityIds.map(() => 100),
      preferences: prefs,
      mainRequest: mainRequest.trim(),
      extraRequest: extraRequest.trim(),
    });
  };

  const label =
    selected.length > 1
      ? selected
          .map(
            (id, i) =>
              `${getDestinationCity(id).nameKo} ${cityWeights[i] ?? 50}%`,
          )
          .join(" · ")
      : getDestinationCity(selected[0] ?? DEFAULT_CITY_ID).nameKo;

  const mapLabel =
    getDestinationCity(selected[0] ?? DEFAULT_CITY_ID).mapProvider === "naver"
      ? "Naver Maps"
      : "Google Maps";

  const setPref = (key: keyof TripPreferenceWeights, v: number) => {
    setPrefs((prev) => ({ ...prev, [key]: v }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: space.xxl + keyboardPad },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
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
      <Text style={[styles.title, { color: colors.text }]}>여행 만들기</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        출발·도착은 세부 지명/주소로, 도시는 여행지로 고르세요. 경유 도시는
        경로에만 반영됩니다.
      </Text>

      <PlaceSearchField
        label="출발"
        value={origin}
        onChange={setOrigin}
        biasCityId={selected[0]}
        placeholder="예: 나리타 공항, 호텔명, 주소…"
        onInputFocus={scrollFocusedIntoView}
      />
      <PlaceSearchField
        label="도착"
        value={endPoint}
        onChange={setEndPoint}
        biasCityId={selected[selected.length - 1] ?? selected[0]}
        placeholder="예: 간사이 공항, 역명, 주소…"
        onInputFocus={scrollFocusedIntoView}
      />

      {recent.length > 0 ? (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            최근 여행지
          </Text>
          <View style={styles.chipWrap}>
            {recent.map((id) => {
              const on = selected.includes(id);
              const meta = getDestinationCity(id);
              const flag = getCountryForCity(id)?.flag ?? "";
              return (
                <Pressable
                  key={`recent-${id}`}
                  style={[
                    styles.cityChip,
                    {
                      backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                      borderColor: on ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleCity(id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                      { color: on ? colors.chipOnFg : colors.chipFg },
                    ]}
                  >
                    {flag} {meta.nameKo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        여행지 국가
      </Text>
      <View style={styles.chipWrap}>
        {COUNTRIES.map((c) => {
          const on = countryId === c.id;
          return (
            <Pressable
              key={c.id}
              style={[
                styles.countryChip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
              onPress={() => selectCountry(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  styles.countryChipText,
                  { color: on ? colors.chipOnFg : colors.chipFg },
                ]}
              >
                {c.flag} {c.nameKo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        여행지 도시 (일정 Day 배정)
      </Text>
      <View style={styles.chipWrap}>
        {countryCities.map((meta) => {
          const on = selected.includes(meta.id);
          return (
            <Pressable
              key={meta.id}
              style={[
                styles.cityChip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleCity(meta.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text
                style={[
                  styles.cityChipText,
                  { color: on ? colors.chipOnFg : colors.chipFg },
                ]}
              >
                {meta.nameKo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.length > 1 ? (
        <View
          style={[styles.ratioBox, { backgroundColor: colors.bgMuted }]}
        >
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>
            여행지 Day 비중
          </Text>
          <Text style={[styles.ratioText, { color: colors.text }]}>
            {getDestinationCity(selected[0]).nameKo} {weightA}% ·{" "}
            {getDestinationCity(selected[1]).nameKo} {weightB}%
          </Text>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepBtnWide, { borderColor: colors.border }]}
              onPress={() => setWeightA((w) => Math.max(20, w - 5))}
              accessibilityLabel="첫 도시 비중 감소"
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {getDestinationCity(selected[0]).nameKo} −
              </Text>
            </Pressable>
            <Pressable
              style={[styles.stepBtnWide, { borderColor: colors.border }]}
              onPress={() => setWeightA((w) => Math.min(80, w + 5))}
              accessibilityLabel="첫 도시 비중 증가"
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {getDestinationCity(selected[0]).nameKo} +
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.weightHint, { color: colors.textMuted }]}>
            기본 50:50 · 5% 단위로 조절 (20–80)
          </Text>
        </View>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        경유 도시 (경로만 · 선택)
      </Text>
      <Text style={[styles.weightHint, { color: colors.textMuted }]}>
        여행지와 별도로, 이동 경로에만 도시명으로 표시됩니다.
      </Text>
      <View style={styles.chipWrap}>
        {countryCities
          .filter((c) => !selected.includes(c.id))
          .map((meta) => {
            const on = stopovers.includes(meta.id);
            return (
              <Pressable
                key={`stop-${meta.id}`}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor: on ? colors.accentMuted : colors.chipBg,
                    borderColor: on ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => toggleStopover(meta.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    { color: on ? colors.accent : colors.chipFg },
                  ]}
                >
                  경유 {meta.nameKo}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <View style={[styles.locked, { backgroundColor: colors.accentMuted }]}>
        <Text style={[styles.lockedText, { color: colors.accent }]}>
          {label}
          {selected.length > 1 ? " · 비중 분할" : ""} · {mapLabel}
        </Text>
      </View>

      <View style={styles.fieldGrid}>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            박수
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
                color: colors.text,
              },
            ]}
            keyboardType="number-pad"
            value={nights}
            onChangeText={setNights}
            onFocus={scrollFocusedIntoView}
          />
        </View>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            일수
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
                color: colors.text,
              },
            ]}
            keyboardType="number-pad"
            value={days}
            onChangeText={setDays}
            onFocus={scrollFocusedIntoView}
          />
        </View>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            인원
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
                color: colors.text,
              },
            ]}
            keyboardType="number-pad"
            value={party}
            onChangeText={setParty}
            onFocus={scrollFocusedIntoView}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        여행 가중치
      </Text>
      <Text style={[styles.weightHint, { color: colors.textMuted }]}>
        1(낮음) ~ 5(높음). AI 일정에 반영됩니다.
      </Text>
      <WeightStepper
        label="맛집"
        hint="로컬 식사·미식"
        value={prefs.food}
        onChange={(v) => setPref("food", v)}
      />
      <WeightStepper
        label="명소"
        hint="관광·랜드마크"
        value={prefs.attraction}
        onChange={(v) => setPref("attraction", v)}
      />
      <WeightStepper
        label="액티비티"
        hint="체험·액티비티"
        value={prefs.activity}
        onChange={(v) => setPref("activity", v)}
      />
      <WeightStepper
        label="비용"
        hint="높을수록 가성비·절약 우선"
        value={prefs.cost}
        onChange={(v) => setPref("cost", v)}
      />
      <WeightStepper
        label="최소 이동거리"
        hint="높을수록 동선 압축"
        value={prefs.minTravel}
        onChange={(v) => setPref("minTravel", v)}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        주요 요청
      </Text>
      <TextInput
        style={[
          styles.textArea,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
            color: colors.text,
          },
        ]}
        multiline
        value={mainRequest}
        onChangeText={setMainRequest}
        onFocus={scrollFocusedIntoView}
        placeholder="예: 가족 여행, 사진 명소 위주…"
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        추가 요청 (최우선)
      </Text>
      <Text style={[styles.weightHint, { color: colors.textMuted }]}>
        여기 적은 내용이 AI 추천에 가장 먼저 반영됩니다.
      </Text>
      <TextInput
        style={[
          styles.textArea,
          {
            borderColor: colors.primary,
            backgroundColor: colors.bgElevated,
            color: colors.text,
          },
        ]}
        multiline
        value={extraRequest}
        onChangeText={setExtraRequest}
        onFocus={scrollFocusedIntoView}
        placeholder="예: 해산물 알레르기, 호텔은 역세권만…"
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
      />

      <Pressable
        style={[
          styles.primary,
          { backgroundColor: colors.primary },
          generating && { opacity: 0.6 },
        ]}
        onPress={() => {
          void submit();
        }}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel="AI 일정 생성"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          {generating ? "AI 일정 생성 중…" : "AI 추천 경로 만들기"}
        </Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: space.xxl },
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
    marginBottom: space.md,
    fontSize: 14,
    lineHeight: 20,
  },
  label: { marginTop: space.md, fontWeight: "700", fontSize: 13 },
  sectionTitle: {
    marginTop: space.xl,
    fontSize: 17,
    fontWeight: "800",
  },
  fieldGrid: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
  },
  fieldCol: { flex: 1 },
  input: {
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  textArea: {
    marginTop: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 88,
    fontSize: 15,
    lineHeight: 22,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  countryChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
    borderRadius: radius.md,
    justifyContent: "center",
    borderWidth: 1.5,
  },
  countryChipText: { fontWeight: "700", fontSize: 13 },
  cityChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: "center",
    borderWidth: 1.5,
  },
  cityChipText: { fontWeight: "800", fontSize: 15 },
  locked: {
    marginTop: space.md,
    borderRadius: radius.md,
    padding: space.md,
  },
  lockedText: { fontWeight: "700", fontSize: 13 },
  ratioBox: {
    marginTop: space.md,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  ratioText: { fontWeight: "800", fontSize: 16 },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.md,
    gap: space.md,
  },
  weightLabel: { fontWeight: "800", fontSize: 15 },
  weightHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnWide: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  stepVal: { width: 28, textAlign: "center", fontWeight: "800", fontSize: 18 },
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
