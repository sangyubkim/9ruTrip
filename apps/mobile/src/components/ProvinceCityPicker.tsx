import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CITIES } from "../data/destinations";
import {
  KOREA_PROVINCES,
  type ProvinceId,
  type ProvinceMeta,
} from "../data/koreaProvinces";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  selectedCityIds: string[];
  onChangeCityIds: (ids: string[]) => void;
  maxCities?: number;
  disabled?: boolean;
};

const COLS = 4;
const ROWS = 7;

function cellAt(row: number, col: number): ProvinceMeta | undefined {
  return KOREA_PROVINCES.find((p) => p.row === row && p.col === col);
}

function provincesForCities(cityIds: string[]): ProvinceId[] {
  const set = new Set<ProvinceId>();
  for (const cityId of cityIds) {
    const prov = KOREA_PROVINCES.find((p) => p.cityIds.includes(cityId));
    if (prov) set.add(prov.id);
  }
  return [...set];
}

export function ProvinceCityPicker({
  selectedCityIds,
  onChangeCityIds,
  maxCities = 6,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const initialProvinces = provincesForCities(selectedCityIds);
  const [selectedProvinces, setSelectedProvinces] =
    useState<ProvinceId[]>(initialProvinces);
  const [focusedProvince, setFocusedProvince] = useState<ProvinceId | null>(
    initialProvinces[0] ?? "seoul",
  );

  const focused = useMemo(
    () => KOREA_PROVINCES.find((p) => p.id === focusedProvince) ?? null,
    [focusedProvince],
  );

  const onProvincePress = (id: ProvinceId) => {
    // 같은 도를 다시 누르면 선택 해제, 다른 도면 포커스 + 선택
    if (focusedProvince === id && selectedProvinces.includes(id)) {
      const next = selectedProvinces.filter((p) => p !== id);
      setSelectedProvinces(next);
      const keepCities = new Set(
        next.flatMap(
          (pid) => KOREA_PROVINCES.find((p) => p.id === pid)?.cityIds ?? [],
        ),
      );
      onChangeCityIds(selectedCityIds.filter((c) => keepCities.has(c)));
      return;
    }
    setFocusedProvince(id);
    if (!selectedProvinces.includes(id)) {
      setSelectedProvinces((prev) => [...prev, id]);
    }
  };

  const toggleCity = (cityId: string) => {
    if (selectedCityIds.includes(cityId)) {
      onChangeCityIds(selectedCityIds.filter((c) => c !== cityId));
      return;
    }
    if (selectedCityIds.length >= maxCities) return;
    onChangeCityIds([...selectedCityIds, cityId]);
    if (focusedProvince && !selectedProvinces.includes(focusedProvince)) {
      setSelectedProvinces((prev) => [...prev, focusedProvince]);
    }
  };

  const selectedLabel = selectedCityIds
    .map((id) => CITIES[id]?.nameKo ?? id)
    .join(" · ");

  return (
    <View
      style={[styles.root, disabled && styles.rootDisabled]}
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityState={{ disabled }}
    >
      <View style={styles.split}>
        <View
          style={[
            styles.mapPane,
            {
              borderColor: disabled ? colors.textMuted : colors.border,
              backgroundColor: disabled ? colors.chipBg : colors.bgElevated,
            },
          ]}
        >
          <Text
            style={[
              styles.paneTitle,
              { color: disabled ? colors.textMuted : colors.textSecondary },
            ]}
          >
            도 (다중 선택)
          </Text>
          <View style={styles.mapGrid}>
            {Array.from({ length: ROWS }, (_, row) => (
              <View key={`r-${row}`} style={styles.mapRow}>
                {Array.from({ length: COLS }, (_, col) => {
                  const prov = cellAt(row, col);
                  if (!prov) {
                    return <View key={`e-${row}-${col}`} style={styles.mapCellEmpty} />;
                  }
                  const on = selectedProvinces.includes(prov.id);
                  const focusedOn = focusedProvince === prov.id;
                  return (
                    <Pressable
                      key={prov.id}
                      style={[
                        styles.mapCell,
                        {
                          backgroundColor: disabled
                            ? colors.chipBg
                            : on
                            ? colors.chipOnBg
                            : colors.chipBg,
                          borderColor: disabled
                            ? colors.textMuted
                            : focusedOn
                            ? colors.primary
                            : on
                              ? colors.primary
                              : colors.border,
                          borderWidth: focusedOn ? 2 : 1,
                        },
                        prov.colSpan === 2 ? styles.mapCellWide : null,
                      ]}
                      onPress={() => onProvincePress(prov.id)}
                      disabled={disabled}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled }}
                      accessibilityLabel={`${prov.nameKo} 선택`}
                    >
                      <Text
                        style={[
                          styles.mapCellText,
                          {
                            color: disabled
                              ? colors.textMuted
                              : on
                                ? colors.chipOnFg
                                : colors.chipFg,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {prov.shortKo}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.cityPane,
            {
              borderColor: disabled ? colors.textMuted : colors.border,
              backgroundColor: disabled ? colors.chipBg : colors.bgElevated,
            },
          ]}
        >
          <Text
            style={[
              styles.paneTitle,
              { color: disabled ? colors.textMuted : colors.textSecondary },
            ]}
          >
            {focused ? `${focused.shortKo} 도시` : "도시"} (다중)
          </Text>
          <ScrollView
            style={styles.cityScroll}
            contentContainerStyle={styles.cityList}
            nestedScrollEnabled
          >
            {(focused?.cityIds ?? []).map((cityId) => {
              const meta = CITIES[cityId];
              if (!meta) return null;
              const on = selectedCityIds.includes(cityId);
              const cityDisabled =
                disabled || (!on && selectedCityIds.length >= maxCities);
              return (
                <Pressable
                  key={cityId}
                  style={[
                    styles.cityChip,
                    {
                      backgroundColor: disabled
                        ? colors.chipBg
                        : on
                          ? colors.chipOnBg
                          : colors.chipBg,
                      borderColor: disabled
                        ? colors.textMuted
                        : on
                          ? colors.primary
                          : colors.border,
                      opacity: cityDisabled ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => toggleCity(cityId)}
                  disabled={cityDisabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: cityDisabled }}
                  accessibilityLabel={`${meta.nameKo} 선택`}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                    {
                      color: disabled
                        ? colors.textMuted
                        : on
                          ? colors.chipOnFg
                          : colors.chipFg,
                    },
                    ]}
                  >
                    {meta.nameKo}
                  </Text>
                </Pressable>
              );
            })}
            {!focused ? (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                왼쪽에서 도를 선택하세요
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <View
        style={[
          styles.summary,
          { backgroundColor: disabled ? colors.chipBg : colors.accentMuted },
        ]}
      >
        <Text
          style={[
            styles.summaryText,
            { color: disabled ? colors.textMuted : colors.accent },
          ]}
        >
          {selectedLabel
            ? `${selectedLabel}${selectedCityIds.length > 1 ? " · Day 균등 분할" : ""}`
            : "여행 도시를 하나 이상 선택하세요"}
        </Text>
        <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>
          {selectedCityIds.length}/{maxCities}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.sm },
  rootDisabled: { opacity: 0.45 },
  split: { flexDirection: "row", gap: space.sm, minHeight: 220 },
  mapPane: {
    flex: 1.15,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  cityPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  paneTitle: { fontSize: 12, fontWeight: "700", marginBottom: space.sm },
  mapGrid: { gap: 4 },
  mapRow: { flexDirection: "row", gap: 4 },
  mapCell: {
    flex: 1,
    minHeight: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  mapCellWide: { flex: 2 },
  mapCellEmpty: { flex: 1, minHeight: 28 },
  mapCellText: { fontSize: 11, fontWeight: "800" },
  cityScroll: { maxHeight: 180 },
  cityList: { gap: 6 },
  cityChip: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    minHeight: 42,
    justifyContent: "center",
  },
  cityChipText: { fontWeight: "800", fontSize: 14 },
  emptyHint: { fontSize: 12, marginTop: space.sm },
  summary: {
    marginTop: space.md,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  summaryText: { flex: 1, fontWeight: "700", fontSize: 13 },
  summaryMeta: { fontSize: 12, fontWeight: "600" },
});
