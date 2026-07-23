import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TransportMode, TransportOption } from "../types";

const MODE_LABEL: Record<TransportMode, string> = {
  walking: "도보",
  transit: "대중교통",
  taxi: "택시",
};

type Props = {
  visible: boolean;
  placeName: string;
  options: TransportOption[];
  selectedMode?: TransportMode;
  loading?: boolean;
  engineHint?: string;
  onSelect: (mode: TransportMode) => void;
  onClose: () => void;
};

export function TransportCompareSheet({
  visible,
  placeName,
  options,
  selectedMode,
  loading,
  engineHint,
  onSelect,
  onClose,
}: Props) {
  const modes: TransportMode[] = ["walking", "transit", "taxi"];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>이동 수단 비교</Text>
          <Text style={styles.sub} numberOfLines={1}>
            → {placeName}
          </Text>
          {engineHint ? (
            <Text style={styles.hint}>{engineHint}</Text>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#0369a1" />
              <Text style={styles.loadingText}>비교 중…</Text>
            </View>
          ) : (
            <View style={styles.row}>
              {modes.map((mode) => {
                const opt = options.find((o) => o.mode === mode);
                const on = selectedMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.card, on && styles.cardOn]}
                    onPress={() => onSelect(mode)}
                  >
                    <Text style={[styles.mode, on && styles.modeOn]}>
                      {MODE_LABEL[mode]}
                    </Text>
                    <Text style={[styles.mins, on && styles.minsOn]}>
                      {opt ? `~${opt.minutes}분` : "—"}
                    </Text>
                    <Text style={[styles.cost, on && styles.costOn]}>
                      {opt
                        ? opt.estimatedCost > 0
                          ? `~¥${opt.estimatedCost.toLocaleString("ja-JP")}`
                          : "무료"
                        : "—"}
                    </Text>
                    {on ? (
                      <Text style={styles.picked}>선택됨</Text>
                    ) : (
                      <Text style={styles.pick}>탭하여 선택</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
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
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  sub: { marginTop: 4, color: "#64748b", fontSize: 13 },
  hint: { marginTop: 4, fontSize: 11, color: "#94a3b8" },
  loading: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  loadingText: { color: "#64748b", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  cardOn: {
    borderColor: "#0284c7",
    backgroundColor: "#e0f2fe",
  },
  mode: { fontWeight: "800", color: "#334155", fontSize: 13 },
  modeOn: { color: "#075985" },
  mins: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  minsOn: { color: "#0c4a6e" },
  cost: { marginTop: 4, fontSize: 12, color: "#64748b" },
  costOn: { color: "#0369a1" },
  pick: { marginTop: 8, fontSize: 10, color: "#94a3b8" },
  picked: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: "#0369a1",
  },
  close: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
  },
  closeText: { fontWeight: "700", color: "#334155" },
});
