import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import type { ItineraryPlace, RouteBriefingFestival } from "../types";
import { computeFestivalInclusion } from "../utils/placeMatch";

type Props = {
  festivals: RouteBriefingFestival[];
  places: ItineraryPlace[];
  /** 기본 compact(배너). briefing은 목록을 기본 펼침 */
  variant?: "compact" | "briefing";
};

/**
 * 선택 축제가 현재 일정에 포함됐는지 + Day 표시.
 * festivals가 비어 있으면 null (섹션 자체 숨김).
 */
export function FestivalInclusionBanner({
  festivals,
  places,
  variant = "compact",
}: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(variant === "briefing");

  const list = useMemo(
    () => (festivals || []).filter((f) => String(f?.name || "").trim()),
    [festivals],
  );

  const inclusion = useMemo(
    () => computeFestivalInclusion(list, places),
    [list, places],
  );

  if (list.length === 0) return null;

  const ratioLabel = `포함 ${inclusion.includedCount}/${inclusion.totalCount}`;
  const allIn =
    inclusion.totalCount > 0 &&
    inclusion.includedCount === inclusion.totalCount;
  const ratioColor = allIn
    ? colors.success
    : inclusion.includedCount === 0
      ? colors.danger
      : colors.accent;

  return (
    <View
      style={[
        styles.box,
        variant === "briefing" && styles.boxBriefing,
        {
          backgroundColor: colors.bgElevated,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`선택 축제, ${ratioLabel}`}
      >
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          선택 축제
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {list.map((f) => f.name).join(" · ")}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.ratio, { color: ratioColor }]}>
            {ratioLabel}
            {allIn ? " · 모두 포함" : ""}
          </Text>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>
            {expanded ? "접기" : "목록"}
          </Text>
        </View>
      </Pressable>

      {expanded && inclusion.items.length > 0 ? (
        <View style={styles.list}>
          {inclusion.items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.row}>
              <Text
                style={[
                  styles.mark,
                  { color: item.included ? colors.success : colors.danger },
                ]}
              >
                {item.included ? "✓" : "✗"}
              </Text>
              <View style={styles.nameCol}>
                <Text
                  style={[
                    styles.wpName,
                    {
                      color: item.included ? colors.text : colors.textMuted,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {item.placeName || item.cityName ? (
                  <Text
                    style={[styles.sub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {[item.placeName, item.cityName].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: item.included ? colors.accent : colors.textMuted,
                  },
                ]}
              >
                {item.dayLabel}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: space.md,
    marginBottom: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
  },
  boxBriefing: {
    marginTop: space.sm,
    marginBottom: 0,
  },
  eyebrow: { fontSize: 11, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 22,
  },
  ratio: { fontSize: 13, fontWeight: "800", flex: 1 },
  chevron: { fontSize: 12, fontWeight: "700" },
  list: { marginTop: space.sm, gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  mark: { fontSize: 14, fontWeight: "900", width: 16, marginTop: 1 },
  nameCol: { flex: 1, minWidth: 0 },
  wpName: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "500", lineHeight: 15 },
  dayLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
    minWidth: 52,
    textAlign: "right",
  },
});
