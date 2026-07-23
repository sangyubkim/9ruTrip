import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ItineraryPlace } from "../types";
import { CATEGORY_LABEL, formatYen } from "../utils/cost";

type Props = {
  visible: boolean;
  categoryLabel: string;
  places: ItineraryPlace[];
  source?: string;
  loading?: boolean;
  onPick: (place: ItineraryPlace) => void;
  onClose: () => void;
};

export function PlaceSuggestModal({
  visible,
  categoryLabel,
  places,
  source,
  loading,
  onPick,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{categoryLabel} 후보 선택</Text>
          <Text style={styles.sub}>
            {source === "places"
              ? "Google Places · 탭하여 추가"
              : "정적 POI · 탭하여 추가"}
          </Text>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#0369a1" />
          ) : (
            <ScrollView style={styles.list}>
              {places.length === 0 ? (
                <Text style={styles.empty}>후보가 없습니다.</Text>
              ) : (
                places.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.row}
                    onPress={() => onPick(p)}
                  >
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>
                      {CATEGORY_LABEL[p.category] || p.category} ·{" "}
                      {formatYen(p.estimatedCost)}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0c4a6e" },
  sub: { marginTop: 4, fontSize: 12, color: "#64748b", marginBottom: 10 },
  list: { maxHeight: 360 },
  empty: { color: "#94a3b8", paddingVertical: 20, textAlign: "center" },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  name: { fontWeight: "700", color: "#0f172a", fontSize: 15 },
  meta: { marginTop: 3, fontSize: 12, color: "#64748b" },
  close: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  closeText: { fontWeight: "700", color: "#334155" },
});
