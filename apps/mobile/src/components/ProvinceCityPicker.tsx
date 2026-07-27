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

function provincesForCities(cityIds: string[]): Set<ProvinceId> {
  const set = new Set<ProvinceId>();
  for (const cityId of cityIds) {
    const prov = KOREA_PROVINCES.find((p) => p.cityIds.includes(cityId));
    if (prov) set.add(prov.id);
  }
  return set;
}

function selectedCountInProvince(
  provinceId: ProvinceId,
  selectedCityIds: string[],
): number {
  const cityIds = KOREA_PROVINCES.find((p) => p.id === provinceId)?.cityIds ?? [];
  return cityIds.filter((id) => selectedCityIds.includes(id)).length;
}

export function ProvinceCityPicker({
  selectedCityIds,
  onChangeCityIds,
  maxCities = 6,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  /** 도시 목록을 열어 둔 도 (단일 포커스, 처음엔 없음) */
  const [focusedProvince, setFocusedProvince] = useState<ProvinceId | null>(null);

  const provincesWithCities = useMemo(
    () => provincesForCities(selectedCityIds),
    [selectedCityIds],
  );

  const focused = useMemo(
    () => KOREA_PROVINCES.find((p) => p.id === focusedProvince) ?? null,
    [focusedProvince],
  );

  const onProvincePress = (id: ProvinceId) => {
    // 같은 도 재탭 → 포커스 해제(테두리/활성 표시 off)
    if (focusedProvince === id) {
      setFocusedProvince(null);
      return;
    }
    // 다른 도 → 이전 포커스는 끄고 해당 도만 활성
    setFocusedProvince(id);
  };

  const toggleCity = (cityId: string) => {
    if (selectedCityIds.includes(cityId)) {
      onChangeCityIds(selectedCityIds.filter((c) => c !== cityId));
      return;
    }
    if (selectedCityIds.length >= maxCities) return;
    onChangeCityIds([...selectedCityIds, cityId]);
  };

  const clearAll = () => {
    onChangeCityIds([]);
    setFocusedProvince(null);
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
            도
          </Text>
          <View style={styles.mapGrid}>
            {Array.from({ length: ROWS }, (_, row) => (
              <View key={`r-${row}`} style={styles.mapRow}>
                {Array.from({ length: COLS }, (_, col) => {
                  const prov = cellAt(row, col);
                  if (!prov) {
                    return <View key={`e-${row}-${col}`} style={styles.mapCellEmpty} />;
                  }
                  const focusedOn = focusedProvince === prov.id;
                  const hasCities = provincesWithCities.has(prov.id);
                  const pickedCount = selectedCountInProvince(
                    prov.id,
                    selectedCityIds,
                  );
                  return (
                    <Pressable
                      key={prov.id}
                      style={[
                        styles.mapCell,
                        {
                          backgroundColor: disabled
                            ? colors.chipBg
                            : focusedOn
                              ? colors.chipOnBg
                              : hasCities
                                ? colors.accentMuted
                                : colors.chipBg,
                          borderColor: disabled
                            ? colors.textMuted
                            : focusedOn
                              ? colors.primary
                              : hasCities
                                ? colors.accent
                                : colors.border,
                          borderWidth: focusedOn || hasCities ? 2 : 1,
                        },
                        prov.colSpan === 2 ? styles.mapCellWide : null,
                      ]}
                      onPress={() => onProvincePress(prov.id)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: focusedOn,
                        disabled,
                      }}
                      accessibilityLabel={`${prov.nameKo}${hasCities ? `, 도시 ${pickedCount}곳 선택됨` : ""}${focusedOn ? ", 목록 열림" : ""}`}
                    >
                      <Text
                        style={[
                          styles.mapCellText,
                          {
                            color: disabled
                              ? colors.textMuted
                              : focusedOn
                                ? colors.chipOnFg
                                : hasCities
                                  ? colors.accent
                                  : colors.chipFg,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {prov.shortKo}
                      </Text>
                      {hasCities ? (
                        <View
                          style={[
                            styles.pickedBadge,
                            {
                              backgroundColor: focusedOn
                                ? colors.primaryFg
                                : colors.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickedBadgeText,
                              {
                                color: focusedOn
                                  ? colors.primary
                                  : colors.primaryFg,
                              },
                            ]}
                          >
                            {pickedCount}
                          </Text>
                        </View>
                      ) : null}
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
            {focused ? `${focused.shortKo} 도시` : "도시"}
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
        <View style={styles.summaryMain}>
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
        {selectedCityIds.length > 0 ? (
          <Pressable
            style={[
              styles.clearBtn,
              {
                borderColor: disabled ? colors.textMuted : colors.border,
                backgroundColor: colors.bgElevated,
              },
            ]}
            onPress={clearAll}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="선택한 여행지 모두 지우기"
          >
            <Text
              style={[
                styles.clearBtnText,
                { color: disabled ? colors.textMuted : colors.text },
              ]}
            >
              전체 지우기
            </Text>
          </Pressable>
        ) : null}
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
    overflow: "visible",
  },
  cityPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  paneTitle: { fontSize: 12, fontWeight: "700", marginBottom: space.sm },
  mapGrid: { gap: 4, overflow: "visible", paddingTop: 4, paddingRight: 4 },
  mapRow: { flexDirection: "row", gap: 4, overflow: "visible" },
  mapCell: {
    flex: 1,
    minHeight: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    position: "relative",
    overflow: "visible",
  },
  mapCellWide: { flex: 2 },
  mapCellEmpty: { flex: 1, minHeight: 28 },
  mapCellText: { fontSize: 11, fontWeight: "800" },
  pickedBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    zIndex: 1,
  },
  pickedBadgeText: { fontSize: 9, fontWeight: "800", lineHeight: 11 },
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
    gap: space.sm,
  },
  summaryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  summaryText: { flex: 1, fontWeight: "700", fontSize: 13 },
  summaryMeta: { fontSize: 12, fontWeight: "600" },
  clearBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 12, fontWeight: "800" },
});
