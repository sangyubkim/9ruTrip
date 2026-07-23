import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CITIES, type MvpCityId } from "../types";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  onBack: () => void;
  onSubmit: (input: {
    cityId: MvpCityId;
    cityIds: MvpCityId[];
    nights: number;
    days: number;
    partySize: number;
  }) => void;
  generating?: boolean;
};

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<MvpCityId[]>(["tokyo"]);
  const [nights, setNights] = useState("2");
  const [days, setDays] = useState("3");
  const [party, setParty] = useState("2");

  const toggleCity = (id: MvpCityId) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  };

  const submit = () => {
    const n = Math.min(14, Math.max(1, parseInt(nights, 10) || 2));
    const d = Math.min(15, Math.max(1, parseInt(days, 10) || n + 1));
    const p = Math.min(12, Math.max(1, parseInt(party, 10) || 2));
    const cityIds = selected.length ? selected : (["tokyo"] as MvpCityId[]);
    onSubmit({
      cityId: cityIds[0],
      cityIds,
      nights: n,
      days: d,
      partySize: p,
    });
  };

  const label =
    selected.length > 1
      ? selected.map((id) => CITIES[id].nameKo).join(" · ")
      : CITIES[selected[0] ?? "tokyo"].nameKo;

  return (
    <View style={styles.root}>
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
        도쿄·오사카 복수 선택 가능(멀티시티). 국내(네이버)는 스캐폴드만.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        도시 (복수 선택)
      </Text>
      <View style={styles.cityRow}>
        {(Object.keys(CITIES) as MvpCityId[]).map((id) => {
          const on = selected.includes(id);
          return (
            <Pressable
              key={id}
              style={[
                styles.cityChip,
                { backgroundColor: on ? colors.chipOnBg : colors.chipBg },
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
          {selected.length > 1 ? " · Day 균등 분할" : ""} · Google Maps
        </Text>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        박수 (nights)
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
            color: colors.textSecondary,
          },
        ]}
        keyboardType="number-pad"
        value={nights}
        onChangeText={setNights}
        accessibilityLabel="박수"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        일수 (days)
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
            color: colors.textSecondary,
          },
        ]}
        keyboardType="number-pad"
        value={days}
        onChangeText={setDays}
        accessibilityLabel="일수"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>인원</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
            color: colors.textSecondary,
          },
        ]}
        keyboardType="number-pad"
        value={party}
        onChangeText={setParty}
        accessibilityLabel="인원"
      />

      <Pressable
        style={[
          styles.primary,
          { backgroundColor: colors.primary },
          generating && { opacity: 0.6 },
        ]}
        onPress={submit}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel="AI 일정 생성"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          {generating ? "AI 일정 생성 중…" : "AI 일정 생성"}
        </Text>
      </Pressable>
    </View>
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
  title: { fontSize: 22, fontWeight: "800" },
  hint: { marginTop: 6, marginBottom: 16 },
  label: { marginTop: 12, fontWeight: "600" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    fontSize: 16,
  },
  cityRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 10,
    justifyContent: "center",
  },
  cityChipText: { fontWeight: "700" },
  locked: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
  },
  lockedText: { fontWeight: "600" },
  primary: {
    marginTop: 24,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "700", fontSize: 16 },
});
