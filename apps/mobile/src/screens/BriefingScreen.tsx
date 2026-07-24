import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Trip, TripPreferenceWeights } from "../types";
import { getCityMeta, tripCitiesLabel } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import { formatYen } from "../utils/cost";

type Props = {
  trip: Trip;
  onContinue: () => void;
  onBack: () => void;
};

const PREF_LABELS: { key: keyof TripPreferenceWeights; label: string }[] = [
  { key: "food", label: "맛집" },
  { key: "attraction", label: "명소" },
  { key: "activity", label: "액티비티" },
  { key: "cost", label: "비용" },
  { key: "minTravel", label: "최소 이동" },
];

export function BriefingScreen({ trip, onContinue, onBack }: Props) {
  const { colors } = useTheme();
  const outline =
    trip.routeOutline ||
    [
      trip.origin?.name,
      tripCitiesLabel(trip),
      ...(trip.stopoverCityIds ?? []).map(
        (id) => `(경유 ${getCityMeta(id).nameKo})`,
      ),
      trip.endPoint?.name,
    ]
      .filter(Boolean)
      .join(" → ");

  const dayLegs =
    trip.cities && trip.cities.length > 0
      ? trip.cities
          .map(
            (c) =>
              `${c.cityName} ${c.dayIndexes.length}일 (Day ${c.dayIndexes.map((d) => d + 1).join(",")})`,
          )
          .join(" · ")
      : trip.cityName;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Pressable
        onPress={onBack}
        style={styles.backHit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <Text style={[styles.back, { color: colors.accent }]}>← 수정</Text>
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
        AI 추천 경로
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>여행 브리핑</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {trip.nights}박 {trip.days}일 · {trip.partySize}명 ·{" "}
        {formatYen(trip.plannedBudget)}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          추천 경로
        </Text>
        <Text style={[styles.route, { color: colors.text }]}>{outline}</Text>
        {trip.origin?.address || trip.endPoint?.address ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {[
              trip.origin?.name
                ? `출발 ${trip.origin.name}${trip.origin.address ? ` (${trip.origin.address})` : ""}`
                : null,
              trip.endPoint?.name
                ? `도착 ${trip.endPoint.name}${trip.endPoint.address ? ` (${trip.endPoint.address})` : ""}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")}
          </Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          여행지 Day 배정
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{dayLegs}</Text>
        {trip.cityWeights && trip.cityWeights.length > 1 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            비중{" "}
            {(trip.cities ?? [])
              .map((c, i) => `${c.cityName} ${trip.cityWeights?.[i] ?? "?"}%`)
              .join(" · ")}
          </Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.accentMuted, borderColor: "transparent" }]}>
        <Text style={[styles.cardLabel, { color: colors.accent }]}>
          간략 브리핑
        </Text>
        <Text style={[styles.briefing, { color: colors.text }]}>
          {trip.briefing || "일정 요약을 준비했습니다. 상세에서 장소를 확인하세요."}
        </Text>
      </View>

      {trip.preferences ? (
        <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            반영된 가중치
          </Text>
          <View style={styles.prefWrap}>
            {PREF_LABELS.map(({ key, label }) => (
              <View
                key={key}
                style={[styles.prefChip, { backgroundColor: colors.chipBg }]}
              >
                <Text style={{ color: colors.chipFg, fontWeight: "700", fontSize: 13 }}>
                  {label} {trip.preferences?.[key] ?? 3}
                </Text>
              </View>
            ))}
          </View>
          {trip.extraRequest ? (
            <Text style={[styles.meta, { color: colors.accent, marginTop: space.sm }]}>
              추가 요청 우선: {trip.extraRequest}
            </Text>
          ) : null}
          {trip.mainRequest ? (
            <Text style={[styles.meta, { color: colors.textMuted, marginTop: space.xs }]}>
              주요 요청: {trip.mainRequest}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.meta, { color: colors.textMuted }]}>
        장소 {trip.places.length}곳 · 상세 일정에서 편집·동선 확인 가능
      </Text>

      <Pressable
        style={[styles.primary, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="상세 일정 보기"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          상세 일정 보기
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: space.xxl },
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  back: { fontSize: 15, fontWeight: "700" },
  eyebrow: { marginTop: space.sm, fontSize: 12, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, marginTop: 4 },
  sub: { marginTop: space.sm, fontSize: 14, fontWeight: "600" },
  card: {
    marginTop: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  cardLabel: { fontSize: 12, fontWeight: "800", marginBottom: space.sm },
  route: { fontSize: 17, fontWeight: "800", lineHeight: 26 },
  body: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  briefing: { fontSize: 15, lineHeight: 24, fontWeight: "600" },
  meta: { marginTop: space.sm, fontSize: 12, lineHeight: 18 },
  prefWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  prefChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
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
