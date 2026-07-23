import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  placeName: string;
  initialTime: string;
  onSave: (hhmm: string) => void;
  onClose: () => void;
};

function normalizeHhmm(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function PlannedTimeModal({
  visible,
  placeName,
  initialTime,
  onSave,
  onClose,
}: Props) {
  const [value, setValue] = useState(initialTime || "09:00");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setValue(initialTime || "09:00");
      setError("");
    }
  }, [visible, initialTime]);

  const save = () => {
    const n = normalizeHhmm(value);
    if (!n) {
      setError("HH:mm 형식 (예: 14:30)");
      return;
    }
    onSave(n);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>예정 시각</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {placeName}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="HH:mm"
            keyboardType="numbers-and-punctuation"
            autoFocus
            maxLength={5}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={save}>
              <Text style={styles.saveText}>저장</Text>
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
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0c4a6e" },
  sub: { marginTop: 4, color: "#64748b", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#0f172a",
  },
  error: { marginTop: 6, color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  cancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  cancelText: { fontWeight: "700", color: "#334155" },
  save: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0369a1",
  },
  saveText: { fontWeight: "700", color: "#fff" },
});
