import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

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
  const [step, setStep] = useState(0);
  const last = step >= STEPS.length - 1;
  const cur = STEPS[step];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.brand}>9ruTrip</Text>
          <Text style={styles.step}>
            {step + 1} / {STEPS.length}
          </Text>
          <Text style={styles.title}>{cur.title}</Text>
          <Text style={styles.body}>{cur.body}</Text>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={STEPS[i].title}
                style={[styles.dot, i === step && styles.dotOn]}
              />
            ))}
          </View>
          <Pressable
            style={styles.btn}
            onPress={() => {
              if (last) onDone();
              else setStep((s) => s + 1);
            }}
          >
            <Text style={styles.btnText}>{last ? "시작하기" : "다음"}</Text>
          </Pressable>
          {!last ? (
            <Pressable onPress={onDone} style={styles.skip}>
              <Text style={styles.skipText}>건너뛰기</Text>
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
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0369a1",
    letterSpacing: 0.4,
  },
  step: { marginTop: 6, fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  title: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "900",
    color: "#0c4a6e",
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 20,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
  },
  dotOn: { backgroundColor: "#0369a1", width: 18 },
  btn: {
    backgroundColor: "#0c4a6e",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  skip: { marginTop: 12, alignItems: "center", padding: 10, minHeight: 44 },
  skipText: { color: "#64748b", fontWeight: "600" },
});
