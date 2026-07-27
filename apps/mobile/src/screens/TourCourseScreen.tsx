import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchTourCourseDetail,
  fetchTourCourses,
  type TourCourseDetail,
  type TourCourseListItem,
  type TourCourseWaypoint,
} from "../api/trip";
import { CoursePreviewMap } from "../components/CoursePreviewMap";
import { CITIES } from "../data/destinations";
import type { MvpCityId } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space, type } from "../theme/tokens";
import { openNaverSearch } from "../utils/naverSearch";

type Props = {
  cityId: MvpCityId;
  selectedCourse: TourCourseDetail | null;
  onBack: () => void;
  onSelect: (course: TourCourseDetail | null) => void;
};

const TOUCH_MIN = 44;

/**
 * 한국관광공사 추천 코스 전체 화면.
 * 목록만 먼저 로드하고, 아코디언 펼침 시 detailInfo2 경유지를 lazy-load.
 */
export function TourCourseScreen({
  cityId,
  selectedCourse,
  onBack,
  onSelect,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<TourCourseListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(
    selectedCourse?.contentId ?? null,
  );
  const [detailById, setDetailById] = useState<
    Record<string, TourCourseDetail>
  >(() =>
    selectedCourse
      ? { [selectedCourse.contentId]: selectedCourse }
      : {},
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [mapCourse, setMapCourse] = useState<TourCourseDetail | null>(null);
  const fetchGen = useRef(0);

  const cityName = CITIES[cityId]?.nameKo ?? cityId;

  const loadList = useCallback(async () => {
    const gen = ++fetchGen.current;
    setListLoading(true);
    try {
      const list = await fetchTourCourses({
        cityId,
        limit: 12,
        lat: CITIES[cityId]?.center.lat,
        lng: CITIES[cityId]?.center.lng,
      });
      if (gen !== fetchGen.current) return;
      setCourses(list);
      if (!list.length) {
        Alert.alert("추천 코스", "이 지역 추천 코스가 없습니다");
      }
    } catch (e) {
      if (gen !== fetchGen.current) return;
      const raw = e instanceof Error ? e.message : "";
      const msg =
        !raw || /^not found$/i.test(raw.trim())
          ? "이 지역 추천 코스가 없습니다"
          : raw;
      Alert.alert("추천 코스", msg);
      setCourses([]);
    } finally {
      if (gen === fetchGen.current) setListLoading(false);
    }
  }, [cityId]);

  useEffect(() => {
    void loadList();
    return () => {
      fetchGen.current += 1;
    };
  }, [loadList]);

  const ensureDetail = async (
    item: TourCourseListItem,
  ): Promise<TourCourseDetail | null> => {
    const cached = detailById[item.contentId];
    if (cached) return cached;
    setDetailLoadingId(item.contentId);
    try {
      const detail = await fetchTourCourseDetail({
        contentId: item.contentId,
        cityId,
      });
      setDetailById((prev) => ({ ...prev, [item.contentId]: detail }));
      return detail;
    } catch (e) {
      Alert.alert(
        "코스 상세",
        e instanceof Error ? e.message : "경유지를 불러오지 못했습니다.",
      );
      return null;
    } finally {
      setDetailLoadingId((cur) => (cur === item.contentId ? null : cur));
    }
  };

  const toggleExpand = async (item: TourCourseListItem) => {
    if (expandedId === item.contentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.contentId);
    await ensureDetail(item);
  };

  const openRouteMap = async (item: TourCourseListItem) => {
    const detail = await ensureDetail(item);
    if (!detail) return;
    const withCoords = (detail.waypoints || []).filter(
      (w) => Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)),
    );
    if (withCoords.length === 0) {
      Alert.alert(
        "동선 확인",
        "이 코스에 표시할 좌표가 없습니다. 경유지 목록만 확인하세요.",
      );
      return;
    }
    setMapCourse(detail);
  };

  const confirmSelect = async (item: TourCourseListItem) => {
    const detail = await ensureDetail(item);
    if (!detail) return;
    onSelect(detail);
    onBack();
  };

  const clearSelect = () => {
    onSelect(null);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, space.sm),
          paddingBottom: Math.max(insets.bottom, space.md),
        },
      ]}
    >
      <Pressable
        onPress={onBack}
        style={styles.backHit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="여행 정보로 돌아가기"
      >
        <Text style={[styles.back, { color: colors.accent }]}>← 여행 정보</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.text }]}>
        한국관광공사 추천 코스
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {cityName} · 코스를 펼치면 경유지가 나오고, AI 일정 시드로 선택할 수
        있습니다.
      </Text>

      {selectedCourse ? (
        <View
          style={[
            styles.seedBar,
            {
              borderColor: colors.primary,
              backgroundColor: colors.accentMuted,
            },
          ]}
        >
          <View style={styles.seedBarText}>
            <Text style={[styles.seedLabel, { color: colors.accent }]}>
              선택됨
            </Text>
            <Text
              style={[styles.seedTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {selectedCourse.title}
            </Text>
          </View>
          <Pressable
            onPress={clearSelect}
            style={styles.sideBtn}
            accessibilityRole="button"
            accessibilityLabel="코스 선택 해제"
          >
            <Text style={[styles.sideBtnText, { color: colors.danger }]}>
              선택 해제
            </Text>
          </Pressable>
        </View>
      ) : null}

      {listLoading ? (
        <ActivityIndicator
          color={colors.accent}
          style={{ marginTop: space.xl }}
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {courses.map((course) => {
            const expanded = expandedId === course.contentId;
            const detail = detailById[course.contentId];
            const loadingDetail = detailLoadingId === course.contentId;
            const isSeed = selectedCourse?.contentId === course.contentId;
            const overview = detail?.overview || course.overview;
            const distance = detail?.distance || course.distance;
            const takeTime = detail?.takeTime || course.takeTime;
            const stopCount =
              typeof detail?.stopCount === "number"
                ? detail.stopCount
                : course.stopCount;
            return (
              <View
                key={course.contentId}
                style={[
                  styles.card,
                  {
                    borderColor: isSeed ? colors.primary : colors.border,
                    backgroundColor: isSeed
                      ? colors.accentMuted
                      : colors.bgElevated,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Pressable
                    style={styles.rowMain}
                    onPress={() => void toggleExpand(course)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${course.title} ${expanded ? "접기" : "펼치기"}`}
                  >
                    <Text
                      style={[styles.cardTitle, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {expanded ? "▾ " : "▸ "}
                      {course.title}
                    </Text>
                    {overview ? (
                      <Text
                        style={[styles.overview, { color: colors.textMuted }]}
                        numberOfLines={expanded ? 4 : 2}
                      >
                        {overview}
                      </Text>
                    ) : null}
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {[
                        distance,
                        takeTime,
                        typeof stopCount === "number"
                          ? `경유 ${stopCount}곳`
                          : null,
                        course.address || cityName,
                        isSeed ? "선택됨" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </Pressable>

                  <View style={styles.sideCol}>
                    <Pressable
                      style={[
                        styles.sideBtn,
                        { borderColor: colors.border },
                      ]}
                      onPress={() => void openRouteMap(course)}
                      accessibilityRole="button"
                      accessibilityLabel={`${course.title} 동선 확인`}
                    >
                      <Text
                        style={[styles.sideBtnText, { color: colors.accent }]}
                      >
                        동선확인
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {expanded ? (
                  <View style={styles.accordion}>
                    {loadingDetail && !detail ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : null}
                    {detail ? (
                      <>
                        {(detail.distance || detail.takeTime) && (
                          <Text
                            style={[styles.meta, { color: colors.textMuted }]}
                          >
                            {[detail.distance, detail.takeTime]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        )}
                        {(detail.waypoints || []).length === 0 ? (
                          <Text
                            style={[styles.meta, { color: colors.textMuted }]}
                          >
                            경유지 정보가 없습니다.
                          </Text>
                        ) : (
                          (detail.waypoints || []).map((wp, idx) => (
                            <WaypointRow
                              key={`${wp.contentId || wp.name}-${idx}`}
                              waypoint={wp}
                              index={idx}
                              colors={colors}
                            />
                          ))
                        )}
                        <View style={styles.confirmRow}>
                          {isSeed ? (
                            <Pressable
                              style={[
                                styles.confirmBtn,
                                {
                                  backgroundColor: colors.bgMuted,
                                  borderColor: colors.border,
                                },
                              ]}
                              onPress={clearSelect}
                              accessibilityRole="button"
                              accessibilityLabel="이 코스 선택 해제"
                            >
                              <Text
                                style={[
                                  styles.confirmBtnText,
                                  { color: colors.text },
                                ]}
                              >
                                선택 해제
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={[
                                styles.confirmBtn,
                                {
                                  backgroundColor: colors.primary,
                                  borderColor: colors.primary,
                                },
                              ]}
                              onPress={() => void confirmSelect(course)}
                              accessibilityRole="button"
                              accessibilityLabel="이 코스로 선택"
                            >
                              <Text
                                style={[
                                  styles.confirmBtnText,
                                  { color: colors.primaryFg },
                                ]}
                              >
                                이 코스로 선택
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(mapCourse)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapCourse(null)}
      >
        <View
          style={[
            styles.mapModal,
            {
              backgroundColor: colors.bg,
              paddingTop: Math.max(insets.top, space.sm),
              paddingBottom: Math.max(insets.bottom, space.md),
            },
          ]}
        >
          <Pressable
            onPress={() => setMapCourse(null)}
            style={styles.backHit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="코스 목록으로"
          >
            <Text style={[styles.back, { color: colors.accent }]}>
              ← 코스 목록
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {mapCourse?.title || "동선 확인"}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            번호 마커 · 경유 순서 연결
            {mapCourse
              ? ` · ${(mapCourse.waypoints || []).filter(
                  (w) =>
                    Number.isFinite(Number(w.lat)) &&
                    Number.isFinite(Number(w.lng)),
                ).length}곳`
              : ""}
          </Text>
          {mapCourse ? (
            <CoursePreviewMap
              cityId={cityId}
              waypoints={mapCourse.waypoints || []}
              height="flex"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function WaypointRow({
  waypoint,
  index,
  colors,
}: {
  waypoint: TourCourseWaypoint;
  index: number;
  colors: {
    text: string;
    textMuted: string;
    accent: string;
    border: string;
    bgMuted: string;
  };
}) {
  const n = waypoint.order || index + 1;
  const info =
    waypoint.address ||
    (waypoint.overview ? waypoint.overview.slice(0, 80) : "") ||
    "";
  return (
    <View
      style={[
        styles.wpRow,
        { borderColor: colors.border, backgroundColor: colors.bgMuted },
      ]}
    >
      <View style={styles.wpMain}>
        <Text style={[styles.wpTitle, { color: colors.text }]} numberOfLines={2}>
          {n}. {waypoint.name}
        </Text>
        {info ? (
          <Text
            style={[styles.wpInfo, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {info}
          </Text>
        ) : null}
      </View>
      <Pressable
        style={[styles.sideBtn, { borderColor: colors.border }]}
        onPress={() => void openNaverSearch(waypoint.name)}
        accessibilityRole="button"
        accessibilityLabel={`${waypoint.name} 네이버 검색`}
      >
        <Text style={[styles.sideBtnText, { color: colors.accent }]}>검색</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  backHit: { minHeight: TOUCH_MIN, justifyContent: "center" },
  back: { fontSize: 15, fontWeight: "700" },
  title: { ...type.title, marginTop: space.xs },
  sub: { ...type.caption, marginTop: space.xs, marginBottom: space.md },
  seedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  seedBarText: { flex: 1, gap: 2 },
  seedLabel: { fontSize: 12, fontWeight: "800" },
  seedTitle: { fontSize: 14, fontWeight: "700" },
  list: { flex: 1 },
  listContent: { gap: space.sm, paddingBottom: space.xl },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  rowMain: { flex: 1, gap: 4, minHeight: TOUCH_MIN },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  overview: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  meta: { fontSize: 12, fontWeight: "600" },
  sideCol: { gap: 6, alignItems: "stretch" },
  sideBtn: {
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtnText: { fontSize: 12, fontWeight: "800" },
  accordion: { gap: space.sm, marginTop: space.xs },
  wpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  wpMain: { flex: 1, gap: 2 },
  wpTitle: { fontSize: 14, fontWeight: "700" },
  wpInfo: { fontSize: 12, lineHeight: 17 },
  confirmRow: { marginTop: space.xs },
  confirmBtn: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  confirmBtnText: { fontSize: 15, fontWeight: "800" },
  mapModal: {
    flex: 1,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
});
