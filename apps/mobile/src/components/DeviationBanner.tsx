import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  distanceKm: number | null;
  onReroute: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

/** GPS 이탈 시 비스팸 배너 — 재루트 CTA */
export function DeviationBanner({
  distanceKm,
  onReroute,
  onDismiss,
  busy,
}: Props) {
  const dist =
    distanceKm != null && Number.isFinite(distanceKm)
      ? `약 ${distanceKm.toFixed(1)}km`
      : "";

  return (
    <View style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>경로 이탈</Text>
        <Text style={styles.title}>경로에서 벗어난 것 같아요 — 재루트할까요?</Text>
        {dist ? <Text style={styles.meta}>다음 장소까지 {dist}</Text> : null}
      </View>
      <Pressable
        style={[styles.btn, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={onReroute}
      >
        <Text style={styles.btnText}>재루트</Text>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Text style={styles.x}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  kicker: { fontSize: 11, fontWeight: "700", color: "#c2410c" },
  title: {
    marginTop: 2,
    fontWeight: "800",
    color: "#7c2d12",
    fontSize: 14,
  },
  meta: { marginTop: 2, fontSize: 12, color: "#9a3412" },
  btn: {
    backgroundColor: "#c2410c",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  x: { color: "#9a3412", fontSize: 16, paddingHorizontal: 4 },
});
