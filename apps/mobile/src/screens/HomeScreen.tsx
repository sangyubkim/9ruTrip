import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Trip, TripStatus } from "../types";
import { formatYen, STATUS_LABEL } from "../utils/cost";

type Props = {
  trips: Trip[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (trip: Trip) => void;
  onSettings: () => void;
  onDelete: (trip: Trip) => void;
  onDuplicate: (trip: Trip) => void;
};

const STATUS_CHIP: Record<
  TripStatus,
  { bg: string; fg: string; border: string }
> = {
  planning: { bg: "#e0f2fe", fg: "#0369a1", border: "#7dd3fc" },
  active: { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7" },
  done: { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" },
};

export function HomeScreen({
  trips,
  loading,
  onCreate,
  onOpen,
  onSettings,
  onDelete,
  onDuplicate,
}: Props) {
  const openTripMenu = (trip: Trip) => {
    Alert.alert(
      `${trip.cityName} · ${trip.nights}박`,
      "여행을 관리할까요?",
      [
        { text: "열기", onPress: () => onOpen(trip) },
        { text: "복제", onPress: () => onDuplicate(trip) },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "여행 삭제",
              `"${trip.cityName} ${trip.nights}박"을(를) 삭제할까요? 되돌릴 수 없습니다.`,
              [
                { text: "취소", style: "cancel" },
                {
                  text: "삭제",
                  style: "destructive",
                  onPress: () => onDelete(trip),
                },
              ],
            );
          },
        },
        { text: "취소", style: "cancel" },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.brand}>9ruTrip</Text>
        <Text style={styles.tag}>도쿄 · 오사카 · Google Maps</Text>
        <Pressable style={styles.primary} onPress={onCreate}>
          <Text style={styles.primaryText}>새 여행 만들기</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={onSettings}>
          <Text style={styles.ghostText}>API 설정</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>저장된 여행</Text>
      {trips.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>아직 여행이 없습니다</Text>
          <Text style={styles.empty}>
            도쿄·오사카 일정을 만들고, 현장에서 한 손으로 다음 액션을 따라가
            보세요.
          </Text>
          <Pressable style={styles.emptyCta} onPress={onCreate}>
            <Text style={styles.emptyCtaText}>첫 여행 만들기</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const chip = STATUS_CHIP[item.status] ?? STATUS_CHIP.planning;
            return (
              <Pressable
                style={styles.card}
                onPress={() => onOpen(item)}
                onLongPress={() => openTripMenu(item)}
                delayLongPress={350}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>
                    {item.cityName} · {item.nights}박 {item.days}일
                  </Text>
                  <Pressable
                    onPress={() => openTripMenu(item)}
                    hitSlop={6}
                    style={styles.menuBtn}
                    accessibilityLabel="여행 메뉴 · 삭제 복제"
                    accessibilityRole="button"
                  >
                    <Text style={styles.menuBtnText}>⋯</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: chip.bg,
                        borderColor: chip.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusChipText, { color: chip.fg }]}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                  <Text style={styles.cardMetaInline}>
                    {item.partySize}명 · 계획 {formatYen(item.plannedBudget)}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {item.places.length}곳 · 리뷰 {item.reviews.length}
                </Text>
                <Text style={styles.hint}>⋯ 메뉴에서 삭제 · 복제</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: "#0c4a6e",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#0369a1",
  },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: "#f0f9ff",
    letterSpacing: 0.3,
  },
  tag: { marginTop: 6, color: "#7dd3fc", fontSize: 13 },
  primary: {
    marginTop: 18,
    backgroundColor: "#38bdf8",
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "700", color: "#0c4a6e", fontSize: 16 },
  ghost: { marginTop: 10, alignItems: "center", padding: 10, minHeight: 44 },
  ghostText: { color: "#bae6fd", fontSize: 14 },
  section: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0c4a6e",
    marginBottom: 8,
  },
  emptyBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#0c4a6e",
    fontSize: 16,
    marginBottom: 6,
  },
  empty: { color: "#64748b", lineHeight: 22 },
  emptyCta: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#0c4a6e",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: "center",
  },
  emptyCtaText: { color: "#fff", fontWeight: "800" },
  sep: { height: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0f172a" },
  menuBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuBtnText: { fontSize: 22, color: "#0c4a6e", fontWeight: "800", lineHeight: 24 },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontWeight: "800" },
  cardMetaInline: { fontSize: 13, color: "#64748b", flexShrink: 1 },
  cardMeta: { marginTop: 6, fontSize: 13, color: "#64748b" },
  hint: { marginTop: 10, fontSize: 12, color: "#64748b", fontWeight: "600" },
});
