import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MVP_CITY } from "../types";

type Props = {
  onBack: () => void;
  onSubmit: (input: { nights: number; days: number; partySize: number }) => void;
  generating?: boolean;
};

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const [nights, setNights] = useState("2");
  const [days, setDays] = useState("3");
  const [party, setParty] = useState("2");

  const submit = () => {
    const n = Math.min(14, Math.max(1, parseInt(nights, 10) || 2));
    const d = Math.min(15, Math.max(1, parseInt(days, 10) || n + 1));
    const p = Math.min(12, Math.max(1, parseInt(party, 10) || 2));
    onSubmit({ nights: n, days: d, partySize: p });
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 뒤로</Text>
      </Pressable>
      <Text style={styles.title}>여행 만들기</Text>
      <Text style={styles.hint}>MVP 지역은 {MVP_CITY.nameKo} (해외) 고정입니다.</Text>

      <Text style={styles.label}>도시</Text>
      <View style={styles.locked}>
        <Text style={styles.lockedText}>
          {MVP_CITY.nameKo} / {MVP_CITY.nameEn} · Google Maps
        </Text>
      </View>

      <Text style={styles.label}>박수 (nights)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={nights}
        onChangeText={setNights}
      />

      <Text style={styles.label}>일수 (days)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={days}
        onChangeText={setDays}
      />

      <Text style={styles.label}>인원</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={party}
        onChangeText={setParty}
      />

      <Pressable
        style={[styles.primary, generating && { opacity: 0.6 }]}
        onPress={submit}
        disabled={generating}
      >
        <Text style={styles.primaryText}>
          {generating ? "AI 일정 생성 중…" : "AI 일정 생성"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", fontSize: 15, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  hint: { marginTop: 6, color: "#64748b", marginBottom: 16 },
  label: { marginTop: 12, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  locked: {
    marginTop: 6,
    backgroundColor: "#e0f2fe",
    borderRadius: 10,
    padding: 12,
  },
  lockedText: { color: "#075985", fontWeight: "600" },
  primary: {
    marginTop: 24,
    backgroundColor: "#0369a1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
