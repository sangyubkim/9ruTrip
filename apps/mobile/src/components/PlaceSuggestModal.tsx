import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ItineraryPlace, PlaceCategory } from "../types";
import { CATEGORY_LABEL, currencyForCity, formatMoney } from "../utils/cost";
import { formatLodgingScoreLines } from "../utils/lodgingExplain";

type Props = {
  visible: boolean;
  category: PlaceCategory;
  categoryLabel: string;
  places: ItineraryPlace[];
  /** 이미 AI 추천 경로에 들어간 장소명 (체크+AI 표시) */
  aiRouteNames?: string[];
  cityId?: string;
  source?: string;
  loading?: boolean;
  onConfirm: (places: ItineraryPlace[]) => void;
  onClose: () => void;
};

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export function PlaceSuggestModal({
  visible,
  category,
  categoryLabel,
  places,
  aiRouteNames = [],
  cityId = "seoul",
  source,
  loading,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const currency = currencyForCity(cityId);
  const isHotel = category === "hotel";
  const aiSet = useMemo(
    () => new Set(aiRouteNames.map(normName)),
    [aiRouteNames],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    const initial = new Set<string>();
    for (const p of places) {
      if (aiSet.has(normName(p.name))) initial.add(p.id);
    }
    if (isHotel) {
      const firstAi = places.find((p) => aiSet.has(normName(p.name)));
      setSelectedIds(firstAi ? new Set([firstAi.id]) : new Set());
    } else {
      setSelectedIds(initial);
    }
  }, [visible, places, aiSet, isHotel]);

  const toggle = (place: ItineraryPlace) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isHotel) {
        return new Set([place.id]);
      }
      if (next.has(place.id)) next.delete(place.id);
      else next.add(place.id);
      return next;
    });
  };

  const confirm = () => {
    const picks = places.filter((p) => selectedIds.has(p.id));
    if (!picks.length) {
      onClose();
      return;
    }
    onConfirm(isHotel ? picks.slice(0, 1) : picks);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{categoryLabel} 후보 선택</Text>
          <Text style={styles.sub}>
            {isHotel
              ? "1일 1곳만 선택 · AI 추천 이유를 확인하세요"
              : source === "places"
                ? "여러 곳 선택 가능 · Google Places"
                : "여러 곳 선택 가능 · 정적 POI"}
          </Text>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#0369a1" />
          ) : (
            <ScrollView style={styles.list}>
              {places.length === 0 ? (
                <Text style={styles.empty}>후보가 없습니다.</Text>
              ) : (
                places.map((p) => {
                  const checked = selectedIds.has(p.id);
                  const inAi = aiSet.has(normName(p.name));
                  const must =
                    p.mustVisit ||
                    (typeof p.rating === "number" && p.rating >= 4.5);
                  const reasonLines = formatLodgingScoreLines(p.scoreBreakdown);
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.row, checked && styles.rowOn]}
                      onPress={() => toggle(p)}
                      accessibilityRole={isHotel ? "radio" : "checkbox"}
                      accessibilityState={{ checked }}
                    >
                      <View style={styles.checkCol}>
                        <View
                          style={[
                            isHotel ? styles.radio : styles.checkbox,
                            checked && styles.checkOn,
                          ]}
                        >
                          {checked ? (
                            <Text style={styles.checkMark}>
                              {isHotel ? "●" : "✓"}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.bodyCol}>
                        <View style={styles.nameRow}>
                          {must ? (
                            <Text style={styles.star} accessibilityLabel="추천">
                              ★
                            </Text>
                          ) : null}
                          <Text style={styles.name}>{p.name}</Text>
                          {inAi ? (
                            <View style={styles.aiBadge}>
                              <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                          ) : null}
                        </View>
                        {p.signatureFood ? (
                          <Text style={styles.meta}>
                            대표 · {p.signatureFood}
                          </Text>
                        ) : null}
                        {p.reviewSummary || p.rating != null ? (
                          <Text style={styles.meta}>
                            {p.reviewSummary ||
                              (p.rating != null ? `평점 ${p.rating}` : "")}
                          </Text>
                        ) : null}
                        {isHotel ? (
                          <View style={styles.reasonBox}>
                            <Text style={styles.reasonTitle}>
                              AI 선택 이유
                              {p.lodgingScore
                                ? ` · ${p.lodgingScore}점`
                                : ""}
                            </Text>
                            {reasonLines.length > 0 ? (
                              reasonLines.map((line) => (
                                <Text key={line} style={styles.reasonLine}>
                                  · {line}
                                </Text>
                              ))
                            ) : (
                              <Text style={styles.reasonLine}>
                                ·{" "}
                                {p.notes ||
                                  p.aiReason ||
                                  "동선·가격·평점을 종합해 추천"}
                              </Text>
                            )}
                            {p.notes ? (
                              <Text style={styles.reasonLine}>· {p.notes}</Text>
                            ) : null}
                          </View>
                        ) : (
                          <Text style={styles.meta}>
                            {CATEGORY_LABEL[p.category] || p.category} ·{" "}
                            {formatMoney(p.estimatedCost, currency)}
                            {p.notes ? ` · ${p.notes}` : ""}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirm,
                selectedIds.size === 0 && { opacity: 0.5 },
              ]}
              disabled={selectedIds.size === 0 || loading}
              onPress={confirm}
            >
              <Text style={styles.confirmText}>
                {isHotel
                  ? "숙소 선택"
                  : `선택 추가 (${selectedIds.size})`}
              </Text>
            </Pressable>
          </View>
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
    maxHeight: "78%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0c4a6e" },
  sub: { marginTop: 4, fontSize: 12, color: "#64748b", marginBottom: 10 },
  list: { maxHeight: 420 },
  empty: { color: "#94a3b8", paddingVertical: 20, textAlign: "center" },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowOn: { backgroundColor: "#f0f9ff" },
  checkCol: { paddingTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: "#0c4a6e",
    borderColor: "#0c4a6e",
  },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  bodyCol: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  star: { color: "#ca8a04", fontWeight: "900", fontSize: 14 },
  name: { fontWeight: "700", color: "#0f172a", fontSize: 15, flexShrink: 1 },
  aiBadge: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: { fontSize: 10, fontWeight: "800", color: "#c2410c" },
  meta: { marginTop: 3, fontSize: 12, color: "#64748b" },
  reasonBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 2,
  },
  reasonLine: { fontSize: 11, color: "#c2410c", marginTop: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  close: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
  },
  closeText: { fontWeight: "700", color: "#334155" },
  confirm: {
    flex: 1.4,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#0c4a6e",
    justifyContent: "center",
  },
  confirmText: { fontWeight: "800", color: "#fff" },
});
