import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_SELECTED_CITIES } from "../data/destinations";
import { ProvinceCityPicker } from "./ProvinceCityPicker";

type Props = {
  visible: boolean;
  initialCityIds: string[];
  title?: string;
  maxCities?: number;
  onConfirm: (cityIds: string[]) => void;
  onClose: () => void;
};

/** 여행 설정 · 도시 배정용 도→도시 다중 선택 */
export function ProvinceCityPickerModal({
  visible,
  initialCityIds,
  title = "도 · 도시 선택",
  maxCities = MAX_SELECTED_CITIES,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(initialCityIds);

  useEffect(() => {
    if (visible) setSelected(initialCityIds);
  }, [visible, initialCityIds]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            도를 고르면 도시 목록이 열립니다. 같은 도를 다시 누르면 닫힙니다.
            도시를 고른 도에는 개수가 표시됩니다 (최대 {maxCities}곳).
          </Text>
          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <ProvinceCityPicker
              selectedCityIds={selected}
              onChangeCityIds={setSelected}
              maxCities={maxCities}
            />
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, selected.length === 0 && { opacity: 0.5 }]}
              disabled={selected.length === 0}
              onPress={() => onConfirm(selected)}
            >
              <Text style={styles.confirmText}>
                적용 ({selected.length})
              </Text>
            </Pressable>
          </View>
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
    maxHeight: "88%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0c4a6e" },
  sub: { marginTop: 4, fontSize: 12, color: "#64748b", marginBottom: 8 },
  body: { maxHeight: 480 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  close: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  closeText: { fontWeight: "700", color: "#334155" },
  confirm: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#0c4a6e",
  },
  confirmText: { fontWeight: "800", color: "#fff" },
});
