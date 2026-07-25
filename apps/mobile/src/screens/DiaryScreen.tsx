import { Alert, ScrollView, Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { TravelDiaryEntry } from "../types";
import { groupDiaryByYear } from "../utils/diary";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  entries: TravelDiaryEntry[];
  onBack: () => void;
  onDelete: (entry: TravelDiaryEntry) => Promise<void>;
};

export function exportDiaryJson(entries: TravelDiaryEntry[]) {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), entries },
    null,
    2,
  );
}

function dateRange(entry: TravelDiaryEntry) {
  if (!entry.startDate || !entry.endDate) return `${entry.nights}박 ${entry.days}일`;
  return `${entry.startDate} ~ ${entry.endDate} · ${entry.nights}박 ${entry.days}일`;
}

export function DiaryScreen({ entries, onBack, onDelete }: Props) {
  const { colors } = useTheme();
  const groups = groupDiaryByYear(entries);
  const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const share = async () => {
    await Share.share({
      title: "9ruTrip 여행 다이어리",
      message: exportDiaryJson(entries),
    });
  };

  const confirmDelete = (entry: TravelDiaryEntry) => {
    Alert.alert("다이어리 삭제", `"${entry.title}" 기록을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void onDelete(entry) },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.accent }]}>← 홈</Text>
        </Pressable>
        <Pressable onPress={() => void share()} accessibilityRole="button">
          <Text style={[styles.export, { color: colors.accent }]}>JSON 내보내기</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>여행 다이어리</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        완료한 여행을 연도별로 모아봅니다
      </Text>
      {years.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            완료한 여행이 여기 쌓입니다
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {years.map((year) => (
            <View key={year}>
              <Text style={[styles.year, { color: colors.text }]}>{year}</Text>
              {groups[year].map((entry) => (
                <View
                  key={entry.id}
                  style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
                >
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{entry.title}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{dateRange(entry)}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {entry.coverPlaceName ? `${entry.coverPlaceName} · ` : ""}
                    장소 {entry.placeCount}곳
                    {entry.plannedBudget ? ` · ${entry.currency ?? ""} ${entry.plannedBudget.toLocaleString()}` : ""}
                  </Text>
                  {entry.notes ? <Text style={[styles.notes, { color: colors.textSecondary }]}>{entry.notes}</Text> : null}
                  <Pressable
                    onPress={() => confirmDelete(entry)}
                    style={styles.deleteButton}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.title} 다이어리 삭제`}
                  >
                    <Text style={styles.deleteText}>삭제</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", minHeight: 44, alignItems: "center" },
  back: { fontWeight: "800", fontSize: 15 },
  export: { fontWeight: "800", fontSize: 14 },
  title: { fontSize: 24, fontWeight: "800", marginTop: space.sm },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: space.lg },
  content: { paddingBottom: space.xl },
  year: { fontSize: 19, fontWeight: "800", marginTop: space.md, marginBottom: space.sm },
  card: { borderRadius: radius.md, padding: space.lg, borderWidth: 1, marginBottom: space.sm },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 13, marginTop: 5 },
  notes: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  deleteButton: { alignSelf: "flex-end", marginTop: space.md, paddingVertical: 6, paddingHorizontal: 4 },
  deleteText: { color: "#b91c1c", fontSize: 13, fontWeight: "800" },
  empty: { borderWidth: 1, borderRadius: radius.md, padding: space.xl, alignItems: "center" },
  emptyText: { fontSize: 15, fontWeight: "700" },
});
