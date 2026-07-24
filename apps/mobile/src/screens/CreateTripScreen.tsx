import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CITIES,
  DOMESTIC_CITY_IDS,
  type MvpCityId,
} from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

let Location: typeof import("expo-location") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require("expo-location");
} catch {
  Location = null;
}

export type CreateTripInput = {
  cityId: MvpCityId;
  cityIds: MvpCityId[];
  nights: number;
  days: number;
  partySize: number;
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startTime: string;
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

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<MvpCityId[]>(["seoul"]);
  const [nights, setNights] = useState("2");
  const [days, setDays] = useState("3");
  const [party, setParty] = useState("2");
  const [startAddress, setStartAddress] = useState("");
  const [startLat, setStartLat] = useState<number | undefined>();
  const [startLng, setStartLng] = useState<number | undefined>();
  const [startTime, setStartTime] = useState("09:00");
  const [userRequest, setUserRequest] = useState("");
  const [locating, setLocating] = useState(false);

  const toggleCity = (id: MvpCityId) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
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
        const geos = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
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
    const n = Math.min(14, Math.max(1, parseInt(nights, 10) || 2));
    const d = Math.min(15, Math.max(1, parseInt(days, 10) || n + 1));
    const p = Math.min(12, Math.max(1, parseInt(party, 10) || 2));
    const cityIds = selected.length ? selected : (["seoul"] as MvpCityId[]);
    const addr = startAddress.trim();
    onSubmit({
      cityId: cityIds[0],
      cityIds,
      nights: n,
      days: d,
      partySize: p,
      startAddress: addr || undefined,
      startLat,
      startLng,
      startTime: normalizeStartTime(startTime),
      userRequest: userRequest.trim() || undefined,
    });
  };

  const label =
    selected.length > 1
      ? selected.map((id) => CITIES[id].nameKo).join(" · ")
      : CITIES[selected[0] ?? "seoul"].nameKo;

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      color: colors.text,
    },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16) + 24,
      }}
      keyboardShouldPersistTaps="handled"
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
        출발지·일정·요청을 입력하면 AI가 추천 경로를 만듭니다.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        출발지 (국내 주소)
      </Text>
      <TextInput
        style={inputStyle}
        value={startAddress}
        onChangeText={(t) => {
          setStartAddress(t);
          setStartLat(undefined);
          setStartLng(undefined);
        }}
        placeholder="예: 서울시 강남구 …"
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
        여행 도시
      </Text>
      <View style={styles.cityRow}>
        {DOMESTIC_CITY_IDS.map((id) => {
          const on = selected.includes(id);
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
              onPress={() => toggleCity(id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${CITIES[id].nameKo} 선택`}
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
      <View style={[styles.locked, { backgroundColor: colors.accentMuted }]}>
        <Text style={[styles.lockedText, { color: colors.accent }]}>
          {label}
          {selected.length > 1 ? " · Day 균등 분할" : ""}
        </Text>
      </View>

      <View style={styles.fieldGrid}>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            박수
          </Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            value={nights}
            onChangeText={setNights}
            accessibilityLabel="박수"
          />
        </View>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            일수
          </Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            value={days}
            onChangeText={setDays}
            accessibilityLabel="일수"
          />
        </View>
        <View style={styles.fieldCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            인원
          </Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            value={party}
            onChangeText={setParty}
            accessibilityLabel="인원"
          />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        여행 시작 시간
      </Text>
      <TextInput
        style={inputStyle}
        value={startTime}
        onChangeText={setStartTime}
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
  cityRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm, flexWrap: "wrap" },
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
