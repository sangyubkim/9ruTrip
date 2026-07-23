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
import { radius, space } from "../theme/tokens";

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
        도시만 고르면 AI가 Day 일정을 만듭니다. 도쿄·오사카 복수 선택 가능.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        도시
      </Text>
      <View style={styles.cityRow}>
        {(Object.keys(CITIES) as MvpCityId[]).map((id) => {
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
          {selected.length > 1 ? " · Day 균등 분할" : ""} · Google Maps
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
            accessibilityLabel="박수"
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
            accessibilityLabel="일수"
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
            accessibilityLabel="인원"
          />
        </View>
      </View>

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
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  hint: {
    marginTop: space.sm,
    marginBottom: space.lg,
    fontSize: 14,
    lineHeight: 20,
  },
  label: { marginTop: space.md, fontWeight: "700", fontSize: 13 },
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
  cityRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
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
