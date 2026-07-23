import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CITIES, type MvpCityId } from "../types";

type Props = {
  onBack: () => void;
  onSubmit: (input: {
    cityId: MvpCityId;
    nights: number;
    days: number;
    partySize: number;
  }) => void;
  generating?: boolean;
};

export function CreateTripScreen({ onBack, onSubmit, generating }: Props) {
  const [cityId, setCityId] = useState<MvpCityId>("tokyo");
  const [nights, setNights] = useState("2");
  const [days, setDays] = useState("3");
  const [party, setParty] = useState("2");

  const city = CITIES[cityId];

  const submit = () => {
    const n = Math.min(14, Math.max(1, parseInt(nights, 10) || 2));
    const d = Math.min(15, Math.max(1, parseInt(days, 10) || n + 1));
    const p = Math.min(12, Math.max(1, parseInt(party, 10) || 2));
    onSubmit({ cityId, nights: n, days: d, partySize: p });
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
        <Text style={styles.back}>← 뒤로</Text>
      </Pressable>
      <Text style={styles.title}>여행 만들기</Text>
      <Text style={styles.hint}>
        해외 도시 · Google Maps. 국내(네이버)는 스캐폴드만 준비됨.
      </Text>

      <Text style={styles.label}>도시</Text>
      <View style={styles.cityRow}>
        {(Object.keys(CITIES) as MvpCityId[]).map((id) => (
          <Pressable
            key={id}
            style={[styles.cityChip, cityId === id && styles.cityChipOn]}
            onPress={() => setCityId(id)}
          >
            <Text
              style={[
                styles.cityChipText,
                cityId === id && styles.cityChipTextOn,
              ]}
            >
              {CITIES[id].nameKo}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.locked}>
        <Text style={styles.lockedText}>
          {city.nameKo} / {city.nameEn} · {city.mapProvider === "google" ? "Google Maps" : "Naver"}
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
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 2,
  },
  back: { color: "#0369a1", fontSize: 15, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: "#0c4a6e" },
  hint: { marginTop: 6, color: "#64748b", marginBottom: 16 },
  label: { marginTop: 12, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  cityRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  cityChipOn: { backgroundColor: "#0369a1" },
  cityChipText: { color: "#334155", fontWeight: "700" },
  cityChipTextOn: { color: "#fff" },
  locked: {
    marginTop: 8,
    backgroundColor: "#e0f2fe",
    borderRadius: 12,
    padding: 12,
  },
  lockedText: { color: "#075985", fontWeight: "600" },
  primary: {
    marginTop: 24,
    backgroundColor: "#0c4a6e",
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
