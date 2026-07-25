import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { enrichPlace, type EnrichedPlace } from "../api/trip";
import { PlaceSearchField } from "./PlaceSearchField";
import { useTheme } from "../theme/ThemeContext";
import type { MvpCityId, PlaceRef } from "../types";

type SearchMode = "name" | "address";

type Props = {
  visible: boolean;
  cityId: MvpCityId;
  onConfirm: (place: EnrichedPlace) => void;
  onClose: () => void;
};

export function ManualPlaceModal({ visible, cityId, onConfirm, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SearchMode>("name");
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const [enriched, setEnriched] = useState<EnrichedPlace | null>(null);
  const [routeName, setRouteName] = useState("");
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setEnriched(null);
      setRouteName("");
      setLoading(false);
      return;
    }
    if (!selected?.name) return;
    const id = ++requestId.current;
    setLoading(true);
    setEnriched(null);
    void enrichPlace({ ...selected, cityId })
      .then((place) => {
        if (id === requestId.current) setEnriched(place);
      })
      .catch(() => {
        if (id === requestId.current) {
          setEnriched({
            name: selected.name,
            address: selected.address,
            lat: selected.lat,
            lng: selected.lng,
            category: "other",
            estimatedCost: 0,
            notes: "직접 추가한 장소",
            engine: "local",
          });
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [selected, cityId, visible]);

  const hasDetails = Boolean(selected?.address) &&
    Number.isFinite(selected?.lat) &&
    Number.isFinite(selected?.lng);
  const displayName = routeName.trim() || enriched?.name || selected?.name || "";
  const canConfirm = Boolean(enriched && displayName && !loading);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.bgElevated, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>장소 직접 추가</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            현재 Day의 마지막 일정으로 추가합니다.
          </Text>
          <View style={styles.tabs}>
            {([
              ["name", "장소 이름으로 검색"],
              ["address", "주소로 검색"],
            ] as const).map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.tab, { backgroundColor: mode === id ? colors.chipOnBg : colors.chipBg }]}
                onPress={() => setMode(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === id }}
              >
                <Text style={{ color: mode === id ? colors.chipOnFg : colors.chipFg, fontWeight: "800", fontSize: 12 }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <PlaceSearchField
            label={mode === "name" ? "장소 이름" : "주소"}
            value={selected}
            onChange={setSelected}
            biasCityId={cityId}
            placeholder={mode === "name" ? "예: 경복궁" : "예: 서울 종로구 사직로 161"}
          />
          {selected && !hasDetails ? (
            <>
              <Text style={[styles.help, { color: colors.textMuted }]}>
                검색 정보가 부족합니다. 경로에 표시할 이름을 확인해 주세요.
              </Text>
              <TextInput
                value={routeName}
                onChangeText={setRouteName}
                placeholder={selected.name}
                placeholderTextColor={colors.textMuted}
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                accessibilityLabel="경로 표시 이름"
              />
            </>
          ) : null}
          {loading ? (
            <View style={styles.status}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textMuted }}>AI로 장소 정보를 채우는 중…</Text></View>
          ) : enriched ? (
            <View style={[styles.result, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <Text style={[styles.resultTitle, { color: colors.text }]}>{displayName}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {enriched.category === "food" ? "맛집" : enriched.category === "attraction" ? "관광" : enriched.category === "transport" ? "교통" : "기타"} · 예상 {enriched.estimatedCost.toLocaleString()}
              </Text>
              {enriched.notes ? <Text style={[styles.note, { color: colors.textSecondary }]}>{enriched.notes}</Text> : null}
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable style={[styles.cancel, { backgroundColor: colors.chipBg }]} onPress={onClose}>
              <Text style={{ color: colors.chipFg, fontWeight: "800" }}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, { backgroundColor: colors.primary }, !canConfirm && { opacity: 0.5 }]}
              disabled={!canConfirm}
              onPress={() => {
                if (enriched) onConfirm({ ...enriched, name: displayName });
              }}
            >
              <Text style={{ color: colors.primaryFg, fontWeight: "800" }}>Day에 추가</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 4 },
  tabs: { flexDirection: "row", gap: 6, marginTop: 12 },
  tab: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  help: { fontSize: 12, marginTop: 12 },
  nameInput: { minHeight: 46, borderWidth: 1, borderRadius: 10, marginTop: 6, paddingHorizontal: 12, fontSize: 14 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  result: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16 },
  resultTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  cancel: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  confirm: { flex: 1.4, minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
