import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { exportTripDraft, publishTripToWordPress } from "../api/trip";
import { FadeIn } from "../components/FadeIn";
import { useTheme } from "../theme/ThemeContext";
import type { Trip } from "../types";
import { buildCostSummary, CATEGORY_LABEL, formatYen } from "../utils/cost";
import { buildExpenseInsights } from "../utils/expenseInsights";

type Props = {
  trip: Trip;
  onBack: () => void;
};

export function SummaryScreen({ trip, onBack }: Props) {
  const { colors, isDark } = useTheme();
  const summary = useMemo(() => buildCostSummary(trip), [trip]);
  const insights = useMemo(
    () => buildExpenseInsights(trip, summary),
    [trip, summary],
  );
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exportedTitle, setExportedTitle] = useState<string | null>(null);
  const [publishLink, setPublishLink] = useState<string | null>(null);

  const onExport = async () => {
    if (trip.reviews.length === 0) {
      Alert.alert("리뷰 없음", "먼저 사진/리뷰를 캡처해 주세요.");
      return;
    }
    setExporting(true);
    try {
      const res = await exportTripDraft(trip);
      setExportedTitle(res.draft.title);
      Alert.alert(
        "발행 초안 준비됨",
        `${res.draft.title}\n\n${res.next.note}\n\n본문 ${res.draft.body.length}자 · 단계 ${res.draft.steps.length}개`,
      );
    } catch (e) {
      Alert.alert(
        "내보내기 실패",
        e instanceof Error ? e.message : "API를 확인해 주세요.",
      );
    } finally {
      setExporting(false);
    }
  };

  const onPublish = async (asDraft: boolean) => {
    if (trip.reviews.length === 0) {
      Alert.alert("리뷰 없음", "먼저 사진/리뷰를 캡처해 주세요.");
      return;
    }
    setPublishing(true);
    try {
      const res = await publishTripToWordPress({
        trip,
        status: asDraft ? "draft" : "publish",
      });
      setPublishLink(res.link);
      Alert.alert(
        asDraft ? "WP 임시글 저장" : "WP 게시 완료",
        `postId ${res.postId}\n${res.link}`,
        [
          { text: "확인" },
          ...(res.link
            ? [
                {
                  text: "열기",
                  onPress: () => void Linking.openURL(res.link),
                },
              ]
            : []),
        ],
      );
    } catch (e) {
      Alert.alert(
        "WordPress 발행 실패",
        e instanceof Error
          ? `${e.message}\n\napps/api/.env 에 WP_SITE_URL / WP_USERNAME / WP_APP_PASSWORD 를 설정하세요.`
          : "API·WP 자격증명을 확인해 주세요.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const insightBg = isDark ? "#052e16" : "#f0fdf4";
  const insightBorder = isDark ? "#166534" : "#bbf7d0";
  const insightFg = isDark ? "#86efac" : "#14532d";

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <FadeIn>
        <Pressable
          onPress={onBack}
          style={styles.backHit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="일정으로 돌아가기"
        >
          <Text style={[styles.back, { color: colors.accent }]}>← 일정</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>계획 vs 실제</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {trip.cityName} · {trip.nights}박 {trip.days}일 · {trip.partySize}명
        </Text>
      </FadeIn>

      <View style={[styles.box, { backgroundColor: colors.primary }]}>
        <Text style={[styles.metric, { color: colors.primaryFg }]}>
          계획 {formatYen(summary.plannedTotal)}
        </Text>
        <Text style={[styles.metric, { color: colors.primaryFg }]}>
          실제 {formatYen(summary.actualTotal)}
        </Text>
        <Text
          style={[
            styles.variance,
            {
              color:
                summary.variance > 0
                  ? isDark
                    ? "#fda4af"
                    : "#fecdd3"
                  : colors.success,
            },
          ]}
        >
          차이 {formatYen(summary.variance)}
          {summary.variance > 0
            ? " (초과)"
            : summary.variance < 0
              ? " (절약)"
              : ""}
        </Text>
      </View>

      <Text style={[styles.section, { color: colors.text }]}>경비 인사이트</Text>
      <View
        style={[
          styles.insightBox,
          { backgroundColor: insightBg, borderColor: insightBorder },
        ]}
      >
        {insights.map((line) => (
          <Text key={line} style={[styles.insightLine, { color: insightFg }]}>
            · {line}
          </Text>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.text }]}>카테고리별</Text>
      {Object.entries(summary.byCategory).map(([key, v]) => (
        <View
          key={key}
          style={[
            styles.row,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.cat, { color: colors.text }]}>
            {CATEGORY_LABEL[key] || key}
          </Text>
          <Text style={[styles.nums, { color: colors.textMuted }]}>
            계획 {formatYen(v.planned)} / 실제 {formatYen(v.actual)}
          </Text>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.text }]}>
        WordPress 발행
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        리뷰 Step → BlogDraft 호환 → 9ruTrip API `/wordpress/publish` (9ruDocs와
        동일 패턴). 자격증명은 API `.env`에 둡니다.
      </Text>
      <Pressable
        style={[
          styles.primary,
          { backgroundColor: colors.primary },
          exporting && { opacity: 0.6 },
        ]}
        onPress={() => void onExport()}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="발행용 초안 내보내기"
      >
        {exporting ? (
          <ActivityIndicator color={colors.primaryFg} />
        ) : (
          <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
            발행용 초안 내보내기
          </Text>
        )}
      </Pressable>
      <View style={styles.wpRow}>
        <Pressable
          style={[
            styles.draftBtn,
            { backgroundColor: colors.accentMuted },
            publishing && { opacity: 0.6 },
          ]}
          disabled={publishing}
          onPress={() => void onPublish(true)}
          accessibilityRole="button"
          accessibilityLabel="WordPress 임시글"
        >
          {publishing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.draftText, { color: colors.accent }]}>
              WP 임시글
            </Text>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.publishBtn,
            { backgroundColor: colors.success },
            publishing && { opacity: 0.6 },
          ]}
          disabled={publishing}
          onPress={() => void onPublish(false)}
          accessibilityRole="button"
          accessibilityLabel="WordPress 바로 게시"
        >
          {publishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.publishText}>WP 바로 게시</Text>
          )}
        </Pressable>
      </View>
      {exportedTitle ? (
        <Text style={[styles.ok, { color: colors.success }]}>
          마지막 초안: {exportedTitle}
        </Text>
      ) : null}
      {publishLink ? (
        <Pressable
          onPress={() => void Linking.openURL(publishLink)}
          accessibilityRole="link"
          accessibilityLabel="게시물 열기"
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            게시물: {publishLink}
          </Text>
        </Pressable>
      ) : null}
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
  back: { fontWeight: "700", fontSize: 15 },
  title: { fontSize: 20, fontWeight: "800" },
  sub: { marginTop: 4 },
  box: {
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
  },
  metric: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  variance: { marginTop: 8, fontSize: 16, fontWeight: "800" },
  section: {
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "800",
    fontSize: 16,
  },
  insightBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  insightLine: { fontSize: 13, lineHeight: 20 },
  row: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  cat: { fontWeight: "700" },
  nums: { marginTop: 4, fontSize: 13 },
  hint: { fontSize: 13, lineHeight: 20 },
  primary: {
    marginTop: 12,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800" },
  wpRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  draftBtn: {
    flex: 1,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: { fontWeight: "700" },
  publishBtn: {
    flex: 1,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: { color: "#fff", fontWeight: "700" },
  ok: { marginTop: 10 },
  link: { marginTop: 8, textDecorationLine: "underline" },
});
