import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Expense, PlaceCategory, Trip } from "../types";
import { CATEGORY_LABEL, formatYen, sumActual } from "../utils/cost";

type Props = {
  trip: Trip;
  onChangeTrip: (trip: Trip) => void;
  onBack: () => void;
};

const CATS: (PlaceCategory | "misc")[] = [
  "food",
  "attraction",
  "hotel",
  "transport",
  "misc",
  "other",
];

export function ExpensesScreen({ trip, onChangeTrip, onBack }: Props) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "misc">("food");

  const add = () => {
    const n = Number(amount);
    if (!label.trim() || !Number.isFinite(n) || n <= 0) {
      Alert.alert("입력 확인", "항목명과 금액(엔)을 입력해 주세요.");
      return;
    }
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      label: label.trim(),
      amount: n,
      currency: "JPY",
      category,
      createdAt: new Date().toISOString(),
    };
    onChangeTrip({
      ...trip,
      expenses: [...trip.expenses, expense],
      updatedAt: new Date().toISOString(),
    });
    setLabel("");
    setAmount("");
  };

  const remove = (id: string) => {
    onChangeTrip({
      ...trip,
      expenses: trip.expenses.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>경비 (현금 수동)</Text>
      <Text style={styles.hint}>
        SMS 파싱은 P1 · 현재 합계 {formatYen(sumActual(trip.expenses))}
      </Text>

      <Text style={styles.label}>항목</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="예: 라멘"
      />
      <Text style={styles.label}>금액 (JPY)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <View style={styles.chips}>
        {CATS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipOn]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
              {CATEGORY_LABEL[c] || c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={add}>
        <Text style={styles.primaryText}>경비 추가</Text>
      </Pressable>

      <FlatList
        style={{ flex: 1, marginTop: 12 }}
        data={[...trip.expenses].reverse()}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.label}</Text>
              <Text style={styles.meta}>
                {CATEGORY_LABEL[item.category] || item.category} · {formatYen(item.amount)}
              </Text>
            </View>
            <Pressable onPress={() => remove(item.id)}>
              <Text style={styles.del}>삭제</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.hint}>아직 경비가 없습니다.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  hint: { color: "#64748b", fontSize: 12, marginTop: 4 },
  label: { marginTop: 10, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  chipOn: { backgroundColor: "#0369a1" },
  chipText: { color: "#334155", fontSize: 12 },
  chipTextOn: { color: "#fff" },
  primary: {
    marginTop: 14,
    backgroundColor: "#0369a1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, color: "#64748b", fontSize: 13 },
  del: { color: "#b91c1c", fontWeight: "600" },
});
