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
import type { Trip } from "../types";
import { buildCostSummary, CATEGORY_LABEL, formatYen } from "../utils/cost";

type Props = {
  trip: Trip;
  onBack: () => void;
};

export function SummaryScreen({ trip, onBack }: Props) {
  const summary = useMemo(() => buildCostSummary(trip), [trip]);
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>계획 vs 실제</Text>
      <Text style={styles.sub}>
        {trip.cityName} · {trip.nights}박 {trip.days}일 · {trip.partySize}명
      </Text>

      <View style={styles.box}>
        <Text style={styles.metric}>계획 {formatYen(summary.plannedTotal)}</Text>
        <Text style={styles.metric}>실제 {formatYen(summary.actualTotal)}</Text>
        <Text
          style={[
            styles.variance,
            summary.variance > 0 ? styles.over : styles.under,
          ]}
        >
          차이 {formatYen(summary.variance)}
          {summary.variance > 0 ? " (초과)" : summary.variance < 0 ? " (절약)" : ""}
        </Text>
      </View>

      <Text style={styles.section}>카테고리별</Text>
      {Object.entries(summary.byCategory).map(([key, v]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.cat}>{CATEGORY_LABEL[key] || key}</Text>
          <Text style={styles.nums}>
            계획 {formatYen(v.planned)} / 실제 {formatYen(v.actual)}
          </Text>
        </View>
      ))}

      <Text style={styles.section}>WordPress 발행</Text>
      <Text style={styles.hint}>
        리뷰 Step → BlogDraft 호환 → 9ruTrip API `/wordpress/publish` (9ruDocs와
        동일 패턴). 자격증명은 API `.env`에 둡니다.
      </Text>
      <Pressable
        style={[styles.primary, exporting && { opacity: 0.6 }]}
        onPress={() => void onExport()}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>발행용 초안 내보내기</Text>
        )}
      </Pressable>
      <View style={styles.wpRow}>
        <Pressable
          style={[styles.draftBtn, publishing && { opacity: 0.6 }]}
          disabled={publishing}
          onPress={() => void onPublish(true)}
        >
          {publishing ? (
            <ActivityIndicator color="#075985" />
          ) : (
            <Text style={styles.draftText}>WP 임시글</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
          disabled={publishing}
          onPress={() => void onPublish(false)}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.publishText}>WP 바로 게시</Text>
          )}
        </Pressable>
      </View>
      {exportedTitle ? (
        <Text style={styles.ok}>마지막 초안: {exportedTitle}</Text>
      ) : null}
      {publishLink ? (
        <Pressable onPress={() => void Linking.openURL(publishLink)}>
          <Text style={styles.link}>게시물: {publishLink}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { color: "#64748b", marginTop: 4 },
  box: {
    marginTop: 16,
    backgroundColor: "#0c4a6e",
    borderRadius: 14,
    padding: 16,
  },
  metric: { color: "#e0f2fe", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  variance: { marginTop: 8, fontSize: 16, fontWeight: "800" },
  over: { color: "#fda4af" },
  under: { color: "#86efac" },
  section: { marginTop: 20, marginBottom: 8, fontWeight: "700", fontSize: 16 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cat: { fontWeight: "700", color: "#0f172a" },
  nums: { marginTop: 4, color: "#64748b", fontSize: 13 },
  hint: { color: "#64748b", fontSize: 13, lineHeight: 20 },
  primary: {
    marginTop: 12,
    backgroundColor: "#0369a1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  wpRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  draftBtn: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  draftText: { color: "#075985", fontWeight: "700" },
  publishBtn: {
    flex: 1,
    backgroundColor: "#15803d",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  publishText: { color: "#fff", fontWeight: "700" },
  ok: { marginTop: 10, color: "#047857" },
  link: { marginTop: 8, color: "#0369a1", textDecorationLine: "underline" },
});
