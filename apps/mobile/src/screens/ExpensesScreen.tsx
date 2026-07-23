import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
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

function extractSharedText(url: string | null): string | null {
  if (!url) return null;
  try {
    const q = url.includes("?") ? url.split("?")[1] : "";
    const params = new URLSearchParams(q);
    const text = params.get("text") || params.get("body");
    return text ? decodeURIComponent(text) : null;
  } catch {
    return null;
  }
}

export function ExpensesScreen({ trip, onChangeTrip, onBack }: Props) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "misc">("food");
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);

  const flash = (msg: string) => {
    setInlineMsg(msg);
    setTimeout(() => setInlineMsg(null), 3500);
  };

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
    flash(`추가됨 · ${lab}`);
  };

  const remove = (id: string) => {
    onChangeTrip({
      ...trip,
      expenses: trip.expenses.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        flash("클립보드가 비어 있습니다. SMS를 복사한 뒤 다시 눌러 주세요.");
        return;
      }
      setSmsText(text.trim());
      flash("붙여넣기 완료 · 아래 「SMS 파싱」을 누르세요.");
    } catch {
      flash("붙여넣기 실패 · 직접 입력해 주세요.");
    }
  }, []);

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    void (async () => {
      const initial = await Linking.getInitialURL();
      const shared = extractSharedText(initial);
      if (shared) setSmsText(shared);
      sub = Linking.addEventListener("url", ({ url }) => {
        const t = extractSharedText(url);
        if (t) setSmsText(t);
      });
    })();
    return () => sub?.remove();
  }, []);

  const parseSms = async () => {
    if (!smsText.trim()) {
      flash("카드 결제 SMS를 붙여넣은 뒤 파싱하세요.");
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
        `가맹점: ${parsed.merchant}\nKRW ${parsed.amountKrw.toLocaleString()}\n추정 JPY ¥${jpy.toLocaleString()}\n\n금액을 확인한 뒤 「추가」를 누르세요.`,
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
      <Pressable onPress={onBack} style={styles.backHit} hitSlop={8}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>경비</Text>
      <Text style={styles.topHint}>
        ① SMS 복사 → 붙여넣기 → 파싱 ② 금액 확인 후 「추가」 · 합계{" "}
        {formatYen(sumActual(trip.expenses))}
      </Text>

      {inlineMsg ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{inlineMsg}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>카드 SMS</Text>
      <Text style={styles.hint}>
        Expo Go는 인박스 자동 읽기 불가 · 복사/공유로 붙여넣기
      </Text>
      <TextInput
        style={[styles.input, styles.smsBox]}
        multiline
        value={smsText}
        onChangeText={setSmsText}
        placeholder="예: [신한] 03/21 14:22 승인 12,000원 스타벅스강남"
        textAlignVertical="top"
      />
      <View style={styles.smsActions}>
        <Pressable
          style={styles.secondary}
          onPress={() => void pasteFromClipboard()}
        >
          <Text style={styles.secondaryText}>붙여넣기</Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondary,
            styles.secondaryPrimary,
            parsing && { opacity: 0.6 },
          ]}
          disabled={parsing}
          onPress={() => void parseSms()}
        >
          <Text style={[styles.secondaryText, styles.secondaryPrimaryText]}>
            {parsing ? "파싱 중…" : "SMS 파싱"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

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
        <Text style={styles.primaryText}>추가</Text>
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
            <Pressable onPress={() => remove(item.id)} style={styles.delHit}>
              <Text style={styles.del}>삭제</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>아직 경비가 없습니다</Text>
            <Text style={styles.hint}>
              SMS를 파싱하거나 항목·금액을 입력한 뒤 「추가」를 누르세요.
            </Text>
          </View>
        }
      />
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
  back: { color: "#0369a1", fontWeight: "700", fontSize: 15 },
  title: { fontSize: 20, fontWeight: "800", color: "#0c4a6e" },
  topHint: {
    color: "#475569",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
    fontWeight: "600",
  },
  hint: { color: "#64748b", fontSize: 12, marginTop: 4, lineHeight: 18 },
  toast: {
    marginTop: 10,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastText: { color: "#e0f2fe", fontSize: 13, fontWeight: "600" },
  label: { marginTop: 12, fontWeight: "700", color: "#0c4a6e" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#cbd5e1",
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    backgroundColor: "#fff",
  },
  smsBox: { minHeight: 72 },
  smsActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: "#0369a1" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  secondary: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPrimary: { backgroundColor: "#0c4a6e" },
  secondaryText: { color: "#075985", fontWeight: "700", fontSize: 13 },
  secondaryPrimaryText: { color: "#fff" },
  primary: {
    marginTop: 16,
    backgroundColor: "#0c4a6e",
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, color: "#64748b", fontSize: 13 },
  delHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  del: { color: "#b91c1c", fontWeight: "700" },
  emptyBox: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: { fontWeight: "800", color: "#0c4a6e", marginBottom: 4 },
});
