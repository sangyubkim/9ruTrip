import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radius, space, type } from "../theme/tokens";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/** Plan 첫 진입 1회 코치마크 — AI 일정에서 ≡ 순서만 안내 */
export function PlanCoachmark({ visible, onDismiss }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
          accessibilityRole="summary"
          accessibilityLabel="AI 일정입니다. ≡로 순서만 바꿔 보세요"
        >
          <Text style={[styles.brand, { color: colors.accent }]}>
            9ruTrip · 일정
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            AI 일정입니다. ≡로 순서만 바꿔 보세요
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            위 배너 힌트처럼 ≡ 길게 = 순서, 왼쪽 밀기 = 삭제, 마커 길게 = 순서
            모드입니다.
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="알겠습니다"
          >
            <Text style={[styles.btnText, { color: colors.primaryFg }]}>
              알겠습니다
            </Text>
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
  title: {
    marginTop: space.md,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 26,
  },
  body: {
    marginTop: space.md,
    fontSize: 14,
    lineHeight: 21,
  },
  btn: {
    marginTop: space.xl,
    borderRadius: radius.md,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "800", fontSize: 16 },
});
