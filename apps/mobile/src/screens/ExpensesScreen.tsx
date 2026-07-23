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
import { parseSmsExpense } from "../api/trip";
import type { Expense, PlaceCategory, Trip } from "../types";
import { CATEGORY_LABEL, formatYen, sumActual } from "../utils/cost";
import { parseKoreanCardSmsLocal } from "../utils/smsParse";

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
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);

  const add = (override?: Partial<Expense> & { label: string; amount: number }) => {
    const n = override?.amount ?? Number(amount);
    const lab = (override?.label ?? label).trim();
    if (!lab || !Number.isFinite(n) || n <= 0) {
      Alert.alert("입력 확인", "항목명과 금액(엔)을 입력해 주세요.");
      return;
    }
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      label: lab,
      amount: n,
      currency: override?.currency ?? "JPY",
      category: override?.category ?? category,
      createdAt: new Date().toISOString(),
      sourceSms: override?.sourceSms,
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

  const parseSms = async () => {
    if (!smsText.trim()) {
      Alert.alert("SMS 붙여넣기", "카드 결제 SMS 전문을 붙여넣어 주세요.");
      return;
    }
    setParsing(true);
    try {
      let parsed = parseKoreanCardSmsLocal(smsText);
      try {
        const remote = await parseSmsExpense(smsText);
        if (remote.ok) parsed = remote;
      } catch {
        // 로컬 파서 유지
      }
      if (!parsed.ok || !parsed.amountKrw) {
        Alert.alert("파싱 실패", parsed.error || "금액/가맹점을 찾지 못했습니다.");
        return;
      }
      const jpy =
        parsed.amountJpyEstimate ?? Math.round(parsed.amountKrw * 0.11);
      setLabel(parsed.merchant || "카드결제");
      setAmount(String(jpy));
      setCategory("misc");
      Alert.alert(
        "SMS 파싱됨",
        `가맹점: ${parsed.merchant}\nKRW ${parsed.amountKrw.toLocaleString()}\n추정 JPY ¥${jpy.toLocaleString()}\n\n금액을 확인한 뒤 경비 추가를 누르세요.\n(환율은 추정값 · 수정 가능)`,
        [
          { text: "확인" },
          {
            text: "바로 추가(JPY)",
            onPress: () =>
              add({
                label: parsed.merchant || "카드결제",
                amount: jpy,
                currency: "JPY",
                category: "misc",
                sourceSms: smsText.trim(),
              }),
          },
        ],
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>경비</Text>
      <Text style={styles.hint}>
        현금 수동 + SMS 붙여넣기 · 합계 {formatYen(sumActual(trip.expenses))}
      </Text>

      <Text style={styles.label}>카드 SMS 붙여넣기 (Android 우선)</Text>
      <Text style={styles.hint}>
        Expo Go에서는 SMS 자동 읽기가 제한되므로, 수신 SMS를 복사해 붙여넣으면
        금액·가맹점을 파싱합니다.
      </Text>
      <TextInput
        style={[styles.input, styles.smsBox]}
        multiline
        value={smsText}
        onChangeText={setSmsText}
        placeholder="예: [신한] 03/21 14:22 승인 12,000원 스타벅스강남"
        textAlignVertical="top"
      />
      <Pressable
        style={[styles.secondary, parsing && { opacity: 0.6 }]}
        disabled={parsing}
        onPress={() => void parseSms()}
      >
        <Text style={styles.secondaryText}>
          {parsing ? "파싱 중…" : "SMS 파싱"}
        </Text>
      </Pressable>

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

      <Pressable style={styles.primary} onPress={() => add()}>
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
                {CATEGORY_LABEL[item.category] || item.category} ·{" "}
                {formatYen(item.amount)}
                {item.sourceSms ? " · SMS" : ""}
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
  smsBox: { minHeight: 72 },
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
  secondary: {
    marginTop: 8,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryText: { color: "#075985", fontWeight: "700" },
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
