import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/** Plan 첫 진입 1회 코치마크 — AI 일정에서 ≡ 순서만 안내 */
export function PlanCoachmark({ visible, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          style={styles.card}
          accessibilityRole="summary"
          accessibilityLabel="AI 일정입니다. ≡로 순서만 바꿔 보세요"
        >
          <Text style={styles.brand}>9ruTrip · 일정</Text>
          <Text style={styles.title}>AI 일정입니다. ≡로 순서만 바꿔 보세요</Text>
          <Text style={styles.body}>
            위 배너 힌트처럼 ≡ 길게 = 순서, 왼쪽 밀기 = 삭제, 마커 길게 = 순서
            모드입니다.
          </Text>
          <Pressable
            style={styles.btn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="알겠습니다"
          >
            <Text style={styles.btnText}>알겠습니다</Text>
          </Pressable>
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
  title: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#0c4a6e",
    lineHeight: 26,
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  btn: {
    marginTop: 20,
    backgroundColor: "#0c4a6e",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
