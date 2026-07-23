import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TransportMode, TransportOption } from "../types";

const MODE_LABEL: Record<TransportMode, string> = {
  walking: "도보",
  transit: "대중교통",
  taxi: "택시",
};

const JP_TRANSIT_NOTE =
  "파트너 API 키가 없으면 추정 시간·요금입니다. 정확한 환승은 Yahoo/Google 앱에서 확인하세요. (Google Directions API는 일본 대중교통 미지원)";

type Props = {
  visible: boolean;
  placeName: string;
  options: TransportOption[];
  selectedMode?: TransportMode;
  loading?: boolean;
  engineHint?: string;
  onSelect: (mode: TransportMode) => void;
  onClose: () => void;
  /** Google Maps transit 길안내 */
  onOpenMapsTransit?: () => void;
  /** Yahoo!乗換案内 */
  onOpenYahooTransit?: () => void;
};

export function TransportCompareSheet({
  visible,
  placeName,
  options,
  selectedMode,
  loading,
  engineHint,
  onSelect,
  onClose,
  onOpenMapsTransit,
  onOpenYahooTransit,
}: Props) {
  const modes: TransportMode[] = ["walking", "transit", "taxi"];
  const transitOpt = options.find((o) => o.mode === "transit");
  const isPartner = Boolean(transitOpt?.engine?.startsWith("partner:"));
  const showJpHonesty =
    !isPartner &&
    (Boolean(transitOpt?.engine?.includes("haversine:transit")) ||
      Boolean(transitOpt?.note) ||
      Boolean(engineHint?.includes("haversine")));
  const honestyText = transitOpt?.note || JP_TRANSIT_NOTE;
  const showTransitLinks =
    Boolean(onOpenMapsTransit || onOpenYahooTransit) &&
    (selectedMode === "transit" || selectedMode == null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>이동 수단 비교</Text>
          <Text style={styles.sub} numberOfLines={1}>
            → {placeName}
          </Text>
          {engineHint ? (
            <Text style={styles.hint}>{engineHint}</Text>
          ) : null}

          {showJpHonesty ? (
            <View style={styles.honesty}>
              <Text style={styles.honestyText}>{honestyText}</Text>
            </View>
          ) : null}
          {isPartner ? (
            <View style={styles.partner}>
              <Text style={styles.partnerText}>
                {transitOpt?.note || "NAVITIME 파트너 API 실측"}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#0369a1" />
              <Text style={styles.loadingText}>비교 중…</Text>
            </View>
          ) : (
            <View style={styles.row}>
              {modes.map((mode) => {
                const opt = options.find((o) => o.mode === mode);
                const on = selectedMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.card, on && styles.cardOn]}
                    onPress={() => onSelect(mode)}
                  >
                    <Text style={[styles.mode, on && styles.modeOn]}>
                      {MODE_LABEL[mode]}
                    </Text>
                    <Text style={[styles.mins, on && styles.minsOn]}>
                      {opt ? `~${opt.minutes}분` : "—"}
                    </Text>
                    <Text style={[styles.cost, on && styles.costOn]}>
                      {opt
                        ? opt.estimatedCost > 0
                          ? `~¥${opt.estimatedCost.toLocaleString("ja-JP")}`
                          : "무료"
                        : "—"}
                    </Text>
                    {mode === "transit" &&
                    opt?.engine?.includes("haversine:transit") ? (
                      <Text style={styles.estTag}>추정</Text>
                    ) : null}
                    {mode === "transit" &&
                    opt?.engine?.startsWith("partner:") ? (
                      <Text style={styles.partnerTag}>파트너</Text>
                    ) : null}
                    {on ? (
                      <Text style={styles.picked}>선택됨</Text>
                    ) : (
                      <Text style={styles.pick}>탭하여 선택</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {showTransitLinks ? (
            <View style={styles.linkRow}>
              {onOpenYahooTransit ? (
                <Pressable
                  style={[styles.linkCta, styles.linkYahoo]}
                  onPress={onOpenYahooTransit}
                >
                  <Text style={styles.linkCtaText}>Yahoo 환승</Text>
                </Pressable>
              ) : null}
              {onOpenMapsTransit ? (
                <Pressable
                  style={[styles.linkCta, styles.linkGoogle]}
                  onPress={onOpenMapsTransit}
                >
                  <Text style={styles.linkCtaText}>Google 환승</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  sub: { marginTop: 4, color: "#64748b", fontSize: 13 },
  hint: { marginTop: 4, fontSize: 11, color: "#94a3b8" },
  honesty: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  honestyText: { fontSize: 12, lineHeight: 18, color: "#9a3412", fontWeight: "600" },
  partner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  partnerText: { fontSize: 12, lineHeight: 18, color: "#065f46", fontWeight: "600" },
  loading: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  loadingText: { color: "#64748b", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  cardOn: {
    borderColor: "#0284c7",
    backgroundColor: "#e0f2fe",
  },
  mode: { fontWeight: "800", color: "#334155", fontSize: 13 },
  modeOn: { color: "#075985" },
  mins: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  minsOn: { color: "#0c4a6e" },
  cost: { marginTop: 4, fontSize: 12, color: "#64748b" },
  costOn: { color: "#0369a1" },
  estTag: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#c2410c",
  },
  partnerTag: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  pick: { marginTop: 8, fontSize: 10, color: "#94a3b8" },
  picked: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: "#0369a1",
  },
  linkRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  linkCta: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  linkYahoo: { backgroundColor: "#ff0033" },
  linkGoogle: { backgroundColor: "#0c4a6e" },
  linkCtaText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  close: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
  },
  closeText: { fontWeight: "700", color: "#334155" },
});
