import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Trip } from "../types";
import { FestivalInclusionBanner } from "../components/FestivalInclusionBanner";
import { SeedCourseInclusionBanner } from "../components/SeedCourseInclusionBanner";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import { currencyForCity, formatMoney } from "../utils/cost";
import { resolveRouteBriefing } from "../utils/routeBriefing";

type Props = {
  trip: Trip;
  onContinue: () => void;
  onBack: () => void;
};

export function BriefingScreen({ trip, onContinue, onBack }: Props) {
  const { colors } = useTheme();
  const rb = resolveRouteBriefing(trip);
  const festivals = rb.festivals ?? [];
  const prefs = rb.requests?.preferences ?? [];
  const hasRequest =
    rb.requests?.reflected ||
    Boolean(rb.requests?.mainRequest || rb.requests?.extraRequest || prefs.length);
  const hasCourse =
    Boolean(trip.seedCourse?.title) ||
    Boolean(rb.courseReflected && rb.seedCourse?.title);
  const hasFestivals = festivals.length > 0;

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
        {rb.durationLabel || `${trip.nights}박 ${trip.days}일`} · {trip.partySize}명 ·{" "}
        {formatMoney(trip.plannedBudget, currencyForCity(trip.cityId))}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          전체 경로 구성
        </Text>
        <Text style={[styles.route, { color: colors.text }]}>{rb.routeSummary}</Text>
        {rb.dayAssignments ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Day 배정 · {rb.dayAssignments}
          </Text>
        ) : null}
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

      <View style={[styles.card, { backgroundColor: colors.accentMuted, borderColor: "transparent" }]}>
        <Text style={[styles.cardLabel, { color: colors.accent }]}>
          AI 요약
        </Text>
        <Text style={[styles.briefing, { color: colors.text }]}>
          {trip.briefing || "일정 요약을 준비했습니다. 아래에서 반영 내역을 확인하세요."}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>반영 내역</Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        요청·축제·관광공사 코스가 일정에 어떻게 들어갔는지 정리했습니다.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
          반영된 요청
        </Text>
        {hasRequest ? (
          <>
            {rb.requests?.extraRequest ? (
              <View style={styles.rowBlock}>
                <Text style={[styles.rowTag, { color: colors.accent }]}>추가 요청</Text>
                <Text style={[styles.body, { color: colors.text }]}>
                  {rb.requests.extraRequest}
                </Text>
              </View>
            ) : null}
            {rb.requests?.mainRequest ? (
              <View style={styles.rowBlock}>
                <Text style={[styles.rowTag, { color: colors.textMuted }]}>주요 요청</Text>
                <Text style={[styles.body, { color: colors.text }]}>
                  {rb.requests.mainRequest}
                </Text>
              </View>
            ) : null}
            {prefs.length > 0 ? (
              <View style={[styles.prefWrap, { marginTop: space.sm }]}>
                {prefs.map((p) => (
                  <View
                    key={p.key}
                    style={[styles.prefChip, { backgroundColor: colors.chipBg }]}
                  >
                    <Text style={{ color: colors.chipFg, fontWeight: "700", fontSize: 13 }}>
                      {p.label} {p.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.bodyMuted, { color: colors.textMuted }]}>
            별도 요청 없이 기본 조건으로 구성했습니다.
          </Text>
        )}
      </View>

      {hasFestivals ? (
        <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            반영된 축제
          </Text>
          <FestivalInclusionBanner
            festivals={festivals}
            places={trip.places}
            variant="briefing"
          />
        </View>
      ) : null}

      {hasCourse && (trip.seedCourse?.title || rb.seedCourse?.title) ? (
        <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            반영된 관광공사 코스
          </Text>
          <SeedCourseInclusionBanner
            seedCourse={{
              contentId: trip.seedCourse?.contentId,
              title: trip.seedCourse?.title || rb.seedCourse!.title,
              source:
                trip.seedCourse?.source ||
                rb.seedCourse?.source ||
                "한국관광공사",
              stopCount:
                trip.seedCourse?.stopCount ?? rb.seedCourse?.stopCount,
              routeSummary:
                trip.seedCourse?.routeSummary || rb.seedCourse?.routeSummary,
              waypoints: trip.seedCourse?.waypoints,
            }}
            places={trip.places}
            cityId={trip.cityId}
            variant="briefing"
          />
        </View>
      ) : null}

      {rb.scheduleRule ? (
        <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            일정 규칙
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>{rb.scheduleRule}</Text>
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
  sectionTitle: {
    marginTop: space.xl,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    marginTop: space.xs,
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    marginTop: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  cardLabel: { fontSize: 12, fontWeight: "800", marginBottom: space.sm },
  route: { fontSize: 17, fontWeight: "800", lineHeight: 26 },
  body: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  bodyMuted: { fontSize: 14, fontWeight: "500", lineHeight: 21 },
  briefing: { fontSize: 15, lineHeight: 24, fontWeight: "600" },
  meta: { marginTop: space.sm, fontSize: 12, lineHeight: 18 },
  rowBlock: { marginTop: space.md },
  rowTag: { fontSize: 11, fontWeight: "800", marginBottom: 4 },
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
