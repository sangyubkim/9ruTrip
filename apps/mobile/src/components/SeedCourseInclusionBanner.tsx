import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchTourCourseDetail,
  type TourCourseWaypoint,
} from "../api/trip";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import type { ItineraryPlace, MvpCityId } from "../types";
import {
  computeSeedCourseInclusion,
  type CourseWaypointLike,
  waypointsFromRouteSummary,
} from "../utils/placeMatch";

type SeedMeta = {
  contentId?: string;
  title: string;
  source?: string;
  stopCount?: number;
  routeSummary?: string;
  waypoints?: CourseWaypointLike[];
};

type Props = {
  seedCourse: SeedMeta;
  places: ItineraryPlace[];
  cityId?: MvpCityId;
  /** 기본 compact(배너). briefing은 목록을 기본 펼침 */
  variant?: "compact" | "briefing";
  /** 상세 API로 가져온 경유지를 trip에 저장할 때 */
  onWaypointsResolved?: (waypoints: TourCourseWaypoint[]) => void;
};

/**
 * 한국관광공사 추천 코스 경유지가 현재 일정에 포함됐는지 표시.
 * waypoints가 없으면 contentId로 상세 조회 → 실패 시 routeSummary 폴백.
 */
export function SeedCourseInclusionBanner({
  seedCourse,
  places,
  cityId,
  variant = "compact",
  onWaypointsResolved,
}: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(variant === "briefing");
  const [fetched, setFetched] = useState<TourCourseWaypoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const onResolvedRef = useRef(onWaypointsResolved);
  onResolvedRef.current = onWaypointsResolved;

  const stored = seedCourse.waypoints;
  const hasStored = Array.isArray(stored) && stored.length > 0;

  useEffect(() => {
    if (hasStored || !seedCourse.contentId) return;
    let cancelled = false;
    setLoading(true);
    void fetchTourCourseDetail({
      contentId: seedCourse.contentId,
      cityId,
    })
      .then((detail) => {
        if (cancelled) return;
        const wps = detail.waypoints || [];
        setFetched(wps);
        if (wps.length) onResolvedRef.current?.(wps);
      })
      .catch(() => {
        if (!cancelled) setFetched([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasStored, seedCourse.contentId, cityId]);

  const waypoints = useMemo((): CourseWaypointLike[] => {
    if (hasStored) return stored!;
    if (fetched && fetched.length > 0) return fetched;
    return waypointsFromRouteSummary(seedCourse.routeSummary);
  }, [hasStored, stored, fetched, seedCourse.routeSummary]);

  const inclusion = useMemo(
    () =>
      computeSeedCourseInclusion(seedCourse.title, waypoints, places),
    [seedCourse.title, waypoints, places],
  );

  if (!seedCourse.title) return null;

  const ratioLabel =
    inclusion.totalCount > 0
      ? `포함 ${inclusion.includedCount}/${inclusion.totalCount}`
      : seedCourse.stopCount != null
        ? `경유지 ${seedCourse.stopCount}곳`
        : "경유지 정보 없음";
  const allIn =
    inclusion.totalCount > 0 &&
    inclusion.includedCount === inclusion.totalCount;
  const ratioColor = allIn
    ? colors.success
    : inclusion.includedCount === 0 && inclusion.totalCount > 0
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
        onPress={() =>
          inclusion.totalCount > 0 ? setExpanded((v) => !v) : undefined
        }
        disabled={inclusion.totalCount === 0}
        accessibilityRole="button"
        accessibilityLabel={`추천 코스 ${seedCourse.title}, ${ratioLabel}`}
      >
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {seedCourse.source || "한국관광공사"} 추천 코스
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {seedCourse.title}
        </Text>
        {seedCourse.routeSummary && variant === "briefing" ? (
          <Text
            style={[styles.summary, { color: colors.textMuted }]}
            numberOfLines={3}
          >
            {seedCourse.routeSummary}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={[styles.ratio, { color: ratioColor }]}>
              {ratioLabel}
              {allIn ? " · 모두 포함" : ""}
            </Text>
          )}
          {inclusion.totalCount > 0 ? (
            <Text style={[styles.chevron, { color: colors.textMuted }]}>
              {expanded ? "접기" : "목록"}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {expanded && inclusion.items.length > 0 ? (
        <View style={styles.list}>
          {inclusion.items.map((item) => (
            <View key={`${item.order}-${item.name}`} style={styles.row}>
              <Text
                style={[
                  styles.mark,
                  { color: item.included ? colors.success : colors.danger },
                ]}
              >
                {item.included ? "✓" : "✗"}
              </Text>
              <Text
                style={[
                  styles.wpName,
                  {
                    color: item.included
                      ? colors.text
                      : colors.textMuted,
                  },
                ]}
                numberOfLines={2}
              >
                {item.order}. {item.name}
              </Text>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: item.included
                      ? colors.accent
                      : colors.textMuted,
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
  summary: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: "500" },
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
  list: { marginTop: space.sm, gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  mark: { fontSize: 14, fontWeight: "900", width: 16, marginTop: 1 },
  wpName: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  dayLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
    minWidth: 52,
    textAlign: "right",
  },
});
