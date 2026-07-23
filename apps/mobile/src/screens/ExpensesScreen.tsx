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
import { EmptyState } from "../components/EmptyState";
import { FadeIn } from "../components/FadeIn";
import { InlineToast } from "../components/InlineToast";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
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
  const { colors } = useTheme();
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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <FadeIn>
        <Pressable
          onPress={onBack}
          style={styles.backHit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="일정으로 돌아가기"
        >
          <Text style={[styles.back, { color: colors.accent }]}>← 일정</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>경비</Text>
        <View style={styles.sumRow}>
          <Text style={[styles.topHint, { color: colors.textSecondary }]}>
            SMS 붙여넣기 → 파싱 → 확인 후 추가
          </Text>
          <View
            style={[styles.sumChip, { backgroundColor: colors.accentMuted }]}
          >
            <Text style={[styles.sumChipText, { color: colors.accent }]}>
              {formatYen(sumActual(trip.expenses))}
            </Text>
          </View>
        </View>
      </FadeIn>

      {inlineMsg ? (
        <InlineToast message={inlineMsg} withFade />
      ) : null}

      <Text style={[styles.label, { color: colors.text }]}>카드 SMS</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Expo Go는 인박스 자동 읽기 불가 · 복사/공유로 붙여넣기
      </Text>
      <TextInput
        style={[
          styles.input,
          styles.smsBox,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        multiline
        value={smsText}
        onChangeText={setSmsText}
        placeholder="예: [신한] 03/21 14:22 승인 12,000원 스타벅스강남"
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
        accessibilityLabel="카드 SMS 텍스트"
      />
      <View style={styles.smsActions}>
        <Pressable
          style={[styles.secondary, { backgroundColor: colors.accentMuted }]}
          onPress={() => void pasteFromClipboard()}
          accessibilityRole="button"
          accessibilityLabel="클립보드 붙여넣기"
        >
          <Text style={[styles.secondaryText, { color: colors.accent }]}>
            붙여넣기
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondary,
            { backgroundColor: colors.primary },
            parsing && { opacity: 0.6 },
          ]}
          disabled={parsing}
          onPress={() => void parseSms()}
          accessibilityRole="button"
          accessibilityLabel="SMS 파싱"
        >
          <Text style={[styles.secondaryText, { color: colors.primaryFg }]}>
            {parsing ? "파싱 중…" : "SMS 파싱"}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.label, { color: colors.text }]}>항목</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={label}
        onChangeText={setLabel}
        placeholder="예: 라멘"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="경비 항목명"
      />
      <Text style={[styles.label, { color: colors.text }]}>금액 (JPY)</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
        accessibilityLabel="금액 엔"
      />

      <View style={styles.chips}>
        {CATS.map((c) => {
          const on = category === c;
          return (
            <Pressable
              key={c}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                },
              ]}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityLabel={`카테고리 ${CATEGORY_LABEL[c] || c}`}
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: on ? colors.chipOnFg : colors.chipFg },
                ]}
              >
                {CATEGORY_LABEL[c] || c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.primary, { backgroundColor: colors.primary }]}
        onPress={() => add()}
        accessibilityRole="button"
        accessibilityLabel="경비 추가"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          추가
        </Text>
      </Pressable>

      <FlatList
        style={{ flex: 1, marginTop: 12 }}
        data={[...trip.expenses].reverse()}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>
                {item.label}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {CATEGORY_LABEL[item.category] || item.category} ·{" "}
                {formatYen(item.amount)}
                {item.sourceSms ? " · SMS" : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => remove(item.id)}
              style={styles.delHit}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} 삭제`}
            >
              <Text style={[styles.del, { color: colors.danger }]}>삭제</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            glyph="¥"
            title="아직 경비가 없습니다"
            body="SMS를 파싱하거나 항목·금액을 입력한 뒤 「추가」를 누르세요."
          />
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
  back: { fontWeight: "700", fontSize: 15 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  sumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginTop: space.sm,
    flexWrap: "wrap",
  },
  topHint: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  sumChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: "center",
  },
  sumChipText: { fontSize: 14, fontWeight: "900" },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  label: { marginTop: space.md, fontWeight: "700", fontSize: 13 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  smsBox: { minHeight: 72 },
  smsActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 10,
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  secondary: {
    flex: 1,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "700", fontSize: 13 },
  primary: {
    marginTop: 16,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "900", fontSize: 17 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  name: { fontWeight: "700" },
  meta: { marginTop: 2, fontSize: 13 },
  delHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  del: { fontWeight: "700" },
});
