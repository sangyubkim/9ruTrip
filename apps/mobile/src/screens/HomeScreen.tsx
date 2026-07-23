import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Trip } from "../types";
import { formatYen } from "../utils/cost";

type Props = {
  trips: Trip[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (trip: Trip) => void;
  onSettings: () => void;
};

export function HomeScreen({
  trips,
  loading,
  onCreate,
  onOpen,
  onSettings,
}: Props) {
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
        <Text style={styles.empty}>아직 여행이 없습니다. 도쿄 일정을 만들어 보세요.</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpen(item)}>
              <Text style={styles.cardTitle}>
                {item.cityName} · {item.nights}박 {item.days}일
              </Text>
              <Text style={styles.cardMeta}>
                {item.partySize}명 · {item.status} · 계획 {formatYen(item.plannedBudget)}
              </Text>
              <Text style={styles.cardMeta}>{item.places.length}곳 · 리뷰 {item.reviews.length}</Text>
            </Pressable>
          )}
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
    borderRadius: 18,
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
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: "#0c4a6e", fontSize: 16 },
  ghost: { marginTop: 10, alignItems: "center", padding: 8 },
  ghostText: { color: "#bae6fd", fontSize: 14 },
  section: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0c4a6e",
    marginBottom: 8,
  },
  empty: { color: "#64748b", lineHeight: 22 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  cardMeta: { marginTop: 4, fontSize: 13, color: "#64748b" },
});
