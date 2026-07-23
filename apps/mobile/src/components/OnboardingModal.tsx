import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { radius, space, type } from "../theme/tokens";

const STEPS = [
  {
    title: "여행 만들기",
    body: "홈에서 「새 여행 만들기」로 도쿄·오사카 일정을 만듭니다. 카드의 ⋯ 메뉴로 삭제·복제할 수 있습니다.",
  },
  {
    title: "일정 다듬기",
    body: "≡ 핸들을 길게 눌러 순서를 바꾸고, 🕒로 시각을, Day▶로 다른 날로 옮깁니다. 변경은 하단 「실행 취소」로 되돌릴 수 있습니다.",
  },
  {
    title: "현장 · 한 손 조작",
    body: "여행을 시작하면 「다음으로 갈 곳」이 크게 보입니다. 길안내·완료를 누르고, 이동이 막히면 재루트를 쓰세요.",
  },
] as const;

type Props = {
  visible: boolean;
  onDone: () => void;
};

export function OnboardingModal({ visible, onDone }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const last = step >= STEPS.length - 1;
  const cur = STEPS[step];

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
          accessibilityRole="summary"
          accessibilityLabel={`온보딩 ${step + 1}단계 ${cur.title}`}
        >
          <Text style={[styles.brand, { color: colors.accent }]}>9ruTrip</Text>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            {step + 1} / {STEPS.length}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{cur.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {cur.body}
          </Text>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={STEPS[i].title}
                style={[
                  styles.dot,
                  { backgroundColor: colors.border },
                  i === step && [
                    styles.dotOn,
                    { backgroundColor: colors.accent },
                  ],
                ]}
              />
            ))}
          </View>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (last) onDone();
              else setStep((s) => s + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={last ? "시작하기" : "다음"}
          >
            <Text style={[styles.btnText, { color: colors.primaryFg }]}>
              {last ? "시작하기" : "다음"}
            </Text>
          </Pressable>
          {!last ? (
            <Pressable
              onPress={onDone}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel="건너뛰기"
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                건너뛰기
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: space.xl,
  },
  card: {
    borderRadius: radius.lg,
    padding: space.xl,
    borderWidth: 1,
  },
  brand: {
    fontSize: type.label.fontSize,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  step: {
    marginTop: space.sm,
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    marginTop: space.md,
    fontSize: type.title.fontSize,
    fontWeight: "900",
    letterSpacing: type.title.letterSpacing,
  },
  body: {
    marginTop: space.md,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOn: { width: 18 },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "800", fontSize: 16 },
  skip: {
    marginTop: space.md,
    alignItems: "center",
    padding: 10,
    minHeight: 44,
  },
  skipText: { fontWeight: "600" },
});
