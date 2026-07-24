import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Trip, TripStatus } from "../types";
import { tripCitiesLabel } from "../types";
import { EmptyState } from "../components/EmptyState";
import { currencyForCity, formatMoney, STATUS_LABEL } from "../utils/cost";
import { useTheme } from "../theme/ThemeContext";
import { radius, space, type } from "../theme/tokens";

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const openTripMenu = (trip: Trip) => {
    Alert.alert(
      `${tripCitiesLabel(trip)} · ${trip.nights}박`,
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
              `"${tripCitiesLabel(trip)} ${trip.nights}박"을(를) 삭제할까요? 되돌릴 수 없습니다.`,
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: "#0c4a6e",
            borderColor: colors.accent,
          },
        ]}
      >
        <Text style={styles.brand} accessibilityRole="header">
          9ruTrip
        </Text>
        <Text style={styles.tag}>국가·도시 선택 · 한 손으로 따라가는 여행</Text>
        <Pressable
          style={styles.primary}
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="새 여행 만들기"
        >
          <Text style={styles.primaryText}>새 여행 만들기</Text>
        </Pressable>
        <Pressable
          style={styles.ghost}
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="설정"
        >
          <Text style={styles.ghostText}>설정 · 테마 · API</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.text }]}>저장된 여행</Text>
        {trips.length > 0 ? (
          <View
            style={[styles.countChip, { backgroundColor: colors.accentMuted }]}
            accessibilityLabel={`${trips.length}개`}
          >
            <Text style={[styles.countChipText, { color: colors.accent }]}>
              {trips.length}
            </Text>
          </View>
        ) : null}
      </View>
      {trips.length === 0 ? (
        <EmptyState
          glyph="✈"
          title="아직 여행이 없습니다"
          body="서울·부산·제주 일정을 만들고, 현장에서 한 손으로 다음 액션을 따라가 보세요."
          ctaLabel="첫 여행 만들기"
          onCta={onCreate}
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const chip = STATUS_CHIP[item.status] ?? STATUS_CHIP.planning;
            return (
              <Pressable
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.bgElevated,
                    borderColor: colors.mapBorder,
                  },
                ]}
                onPress={() => onOpen(item)}
                onLongPress={() => openTripMenu(item)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${tripCitiesLabel(item)} ${item.nights}박 여행 열기`}
              >
                <View style={styles.cardTop}>
                  <Text
                    style={[styles.cardTitle, { color: colors.textSecondary }]}
                  >
                    {tripCitiesLabel(item)} · {item.nights}박 {item.days}일
                  </Text>
                  <Pressable
                    onPress={() => openTripMenu(item)}
                    hitSlop={6}
                    style={[
                      styles.menuBtn,
                      {
                        backgroundColor: colors.bgMuted,
                        borderColor: colors.border,
                      },
                    ]}
                    accessibilityLabel="여행 메뉴 · 삭제 복제"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.menuBtnText, { color: colors.text }]}>
                      ⋯
                    </Text>
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
                    accessibilityRole="text"
                    accessibilityLabel={`상태 ${STATUS_LABEL[item.status]}`}
                  >
                    <Text style={[styles.statusChipText, { color: chip.fg }]}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                  <Text
                    style={[styles.cardMetaInline, { color: colors.textMuted }]}
                  >
                    {item.partySize}명 · 계획{" "}
                    {formatMoney(
                      item.plannedBudget,
                      currencyForCity(item.cityId),
                    )}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                  {item.places.length}곳 · 리뷰 {item.reviews.length}
                  {item.cities && item.cities.length > 1 ? " · 멀티시티" : ""}
                </Text>
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
    borderRadius: radius.lg,
    padding: space.xl,
    marginBottom: space.lg,
    borderWidth: 1,
  },
  brand: {
    ...type.brand,
    color: "#f0f9ff",
  },
  tag: {
    marginTop: space.sm,
    color: "#7dd3fc",
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
  },
  primary: {
    marginTop: space.lg,
    backgroundColor: "#38bdf8",
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800", color: "#0c4a6e", fontSize: 16 },
  ghost: {
    marginTop: space.sm,
    alignItems: "center",
    padding: 12,
    minHeight: 48,
  },
  ghostText: { color: "#bae6fd", fontSize: 14, fontWeight: "600" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.md,
  },
  section: {
    fontSize: 16,
    fontWeight: "800",
  },
  countChip: {
    minWidth: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countChipText: { fontSize: 13, fontWeight: "800" },
  sep: { height: space.sm },
  card: {
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  menuBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  menuBtnText: { fontSize: 22, fontWeight: "800", lineHeight: 24 },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.sm,
    flexWrap: "wrap",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontWeight: "800" },
  cardMetaInline: { fontSize: 13, flexShrink: 1 },
  cardMeta: { marginTop: 6, fontSize: 13 },
});
