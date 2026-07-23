import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { ItineraryPlace, MvpCityId } from "../types";
import { getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  cityId: MvpCityId;
  places: ItineraryPlace[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
  /** 마커 ▲▼ 한 칸 이동 */
  onMoveInDay?: (placeId: string, direction: "up" | "down") => void;
  /** 순서 모드 스트립에서 전체 재정렬 (id 배열) */
  onReorderDay?: (orderedIds: string[]) => void;
};

/**
 * Plan Day 압축 지도.
 * Android react-native-maps 마커 geo-드래그는 불안정 → 롱프레스 「순서 모드」
 * + 하단 번호 스트립(핸들 스왑)으로 순서·enrich·Undo 동기.
 */
export function PlanDayMap({
  cityId,
  places,
  selectedPlaceId,
  onSelectPlace,
  onMoveInDay,
  onReorderDay,
}: Props) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState(false);
  const [stripDragId, setStripDragId] = useState<string | null>(null);

  const coords = useMemo(
    () =>
      places.filter(
        (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
      ),
    [places],
  );

  const region = useMemo(() => {
    if (coords.length === 0) {
      return {
        latitude: city.center.lat,
        longitude: city.center.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    const lats = coords.map((p) => p.lat);
    const lngs = coords.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max(0.04, (maxLat - minLat) * 1.6 || 0.06);
    const lngDelta = Math.max(0.04, (maxLng - minLng) * 1.6 || 0.06);
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [coords, city.center.lat, city.center.lng]);

  const polylineCoords = useMemo(
    () =>
      coords.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
      })),
    [coords],
  );

  useEffect(() => {
    const sel = coords.find((p) => p.id === selectedPlaceId);
    if (!sel || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: sel.lat,
        longitude: sel.lng,
        latitudeDelta: Math.max(0.03, region.latitudeDelta * 0.6),
        longitudeDelta: Math.max(0.03, region.longitudeDelta * 0.6),
      },
      280,
    );
  }, [selectedPlaceId, coords, region.latitudeDelta, region.longitudeDelta]);

  useEffect(() => {
    if (selectedPlaceId && coords.some((p) => p.id === selectedPlaceId)) {
      setReorderId(selectedPlaceId);
    }
  }, [selectedPlaceId, coords]);

  const reorderPlace = coords.find((p) => p.id === reorderId);
  const reorderIndex = reorderPlace
    ? coords.findIndex((p) => p.id === reorderPlace.id)
    : -1;

  const enterOrderMode = (placeId: string) => {
    onSelectPlace?.(placeId);
    setReorderId(placeId);
    setOrderMode(true);
  };

  const exitOrderMode = () => {
    setOrderMode(false);
    setStripDragId(null);
  };

  const handleMarkerPress = (placeId: string) => {
    if (orderMode && stripDragId && stripDragId !== placeId) {
      swapByIds(stripDragId, placeId);
      setStripDragId(null);
      return;
    }
    onSelectPlace?.(placeId);
    setReorderId(placeId);
  };

  const swapByIds = (fromId: string, toId: string) => {
    if (!onReorderDay || fromId === toId) return;
    const ids = coords.map((p) => p.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorderDay(next);
    setReorderId(fromId);
  };

  const onStripPress = (placeId: string) => {
    if (stripDragId) {
      if (stripDragId === placeId) {
        setStripDragId(null);
        return;
      }
      swapByIds(stripDragId, placeId);
      setStripDragId(null);
      return;
    }
    onSelectPlace?.(placeId);
    setReorderId(placeId);
  };

  const onStripLongPress = (placeId: string) => {
    setOrderMode(true);
    setStripDragId(placeId);
    setReorderId(placeId);
    onSelectPlace?.(placeId);
  };

  if (mapCfg.providerId === "naver") {
    return (
      <View style={[styles.stub, { borderColor: colors.mapBorder }]}>
        <Text style={[styles.stubText, { color: colors.accent }]}>
          Naver Maps 스캐폴드 · 장소 {coords.length}곳
        </Text>
      </View>
    );
  }

  const pinSelected = isDark ? "#38bdf8" : "#0284c7";
  const pinDefault = isDark ? "#0c4a6e" : "#0c4a6e";
  const pinOrder = isDark ? "#7dd3fc" : "#0369a1";

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: orderMode ? colors.primary : colors.mapBorder,
          backgroundColor: colors.accentMuted,
          borderWidth: orderMode ? 2 : 1,
        },
      ]}
      accessibilityLabel={
        orderMode
          ? "순서 모드 지도. 스트립에서 핸들을 길게 누른 뒤 다른 번호에 놓으세요"
          : "일정 지도"
      }
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapCfg.rnProvider}
        initialRegion={region}
        onMapReady={() => {
          mapRef.current?.animateToRegion(region, 0);
        }}
      >
        {polylineCoords.length >= 2 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={isDark ? "#38bdf8" : "#0369a1"}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {coords.map((p, i) => {
          const selected = p.id === selectedPlaceId || p.id === reorderId;
          const dragging = p.id === stripDragId;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={`${i + 1}. ${p.name}`}
              description={
                orderMode
                  ? "순서 모드 · 스트립에서 재정렬"
                  : p.plannedTime
                    ? `${p.plannedTime}`
                    : undefined
              }
              pinColor={
                dragging ? pinOrder : selected ? pinSelected : pinDefault
              }
              onPress={() => handleMarkerPress(p.id)}
              // geo-드래그 비활성(Android 불안정) — 순서 모드는 스트립/▲▼
              draggable={false}
              accessibilityLabel={`${i + 1}번 ${p.name} 마커`}
              accessibilityHint="길게 누르면 순서 모드"
            >
              <Pressable
                onPress={() => handleMarkerPress(p.id)}
                onLongPress={() => enterOrderMode(p.id)}
                delayLongPress={380}
                style={[
                  styles.customPin,
                  {
                    backgroundColor: dragging
                      ? pinOrder
                      : selected
                        ? pinSelected
                        : pinDefault,
                    borderColor: orderMode ? "#fff" : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}번 ${p.name}`}
                accessibilityHint="길게 누르면 순서 모드"
              >
                <Text style={styles.customPinText}>{i + 1}</Text>
              </Pressable>
            </Marker>
          );
        })}
      </MapView>
      {coords.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={[styles.emptyText, { color: colors.accent }]}>
            이 Day 장소 없음
          </Text>
        </View>
      ) : null}
      {!mapCfg.hasCredentials ? (
        <Pressable style={styles.keyHint} pointerEvents="none">
          <Text style={styles.keyHintText}>Maps 키 없음 · 기본 지도</Text>
        </Pressable>
      ) : null}

      {(reorderPlace && onMoveInDay) || orderMode ? (
        <View
          style={[styles.reorderBar, { backgroundColor: colors.undoBg }]}
          accessibilityRole="toolbar"
          accessibilityLabel="마커 순서 변경"
        >
          <Text
            style={[styles.reorderTitle, { color: colors.undoFg }]}
            numberOfLines={1}
          >
            {orderMode
              ? `순서 모드 · ≡ 길게 → 다른 번호 탭`
              : reorderPlace
                ? `순서 · ${reorderIndex + 1}. ${reorderPlace.name}`
                : "순서"}
          </Text>
          <View style={styles.reorderActions}>
            {reorderPlace && onMoveInDay ? (
              <>
                <Pressable
                  style={[
                    styles.reorderBtn,
                    { opacity: reorderIndex <= 0 ? 0.35 : 1 },
                  ]}
                  disabled={reorderIndex <= 0}
                  onPress={() => onMoveInDay(reorderPlace.id, "up")}
                  accessibilityRole="button"
                  accessibilityLabel="순서 위로"
                >
                  <Text
                    style={[styles.reorderBtnText, { color: colors.undoFg }]}
                  >
                    ▲
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.reorderBtn,
                    {
                      opacity:
                        reorderIndex < 0 || reorderIndex >= coords.length - 1
                          ? 0.35
                          : 1,
                    },
                  ]}
                  disabled={
                    reorderIndex < 0 || reorderIndex >= coords.length - 1
                  }
                  onPress={() => onMoveInDay(reorderPlace.id, "down")}
                  accessibilityRole="button"
                  accessibilityLabel="순서 아래로"
                >
                  <Text
                    style={[styles.reorderBtnText, { color: colors.undoFg }]}
                  >
                    ▼
                  </Text>
                </Pressable>
              </>
            ) : null}
            {!orderMode ? (
              <Pressable
                style={styles.reorderModeBtn}
                onPress={() =>
                  enterOrderMode(reorderPlace?.id ?? coords[0]?.id ?? "")
                }
                accessibilityRole="button"
                accessibilityLabel="순서 모드 시작"
                accessibilityHint="지도 하단 스트립으로 순서를 바꿉니다"
              >
                <Text
                  style={[styles.reorderCloseText, { color: colors.undoFg }]}
                >
                  순서 모드
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.reorderClose}
                onPress={exitOrderMode}
                accessibilityRole="button"
                accessibilityLabel="순서 모드 종료"
              >
                <Text
                  style={[styles.reorderCloseText, { color: colors.undoFg }]}
                >
                  완료
                </Text>
              </Pressable>
            )}
            {!orderMode ? (
              <Pressable
                style={styles.reorderClose}
                onPress={() => setReorderId(null)}
                accessibilityRole="button"
                accessibilityLabel="순서 변경 닫기"
              >
                <Text
                  style={[styles.reorderCloseText, { color: colors.undoFg }]}
                >
                  닫기
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {orderMode && coords.length > 0 ? (
        <View
          style={[
            styles.stripWrap,
            {
              backgroundColor: isDark
                ? "rgba(15,23,42,0.92)"
                : "rgba(255,255,255,0.94)",
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="list"
          accessibilityLabel="장소 순서 스트립"
        >
          <Text
            style={[styles.stripHint, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            ≡ 길게 누른 뒤 놓을 번호 탭 · Android 지도 핀 드래그 미지원
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}
          >
            {coords.map((p, i) => {
              const active = p.id === reorderId;
              const dragging = p.id === stripDragId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onStripPress(p.id)}
                  onLongPress={() => onStripLongPress(p.id)}
                  delayLongPress={200}
                  style={[
                    styles.stripChip,
                    {
                      backgroundColor: dragging
                        ? colors.chipOnBg
                        : active
                          ? colors.accentMuted
                          : colors.chipBg,
                      borderColor: dragging
                        ? colors.primary
                        : active
                          ? colors.accent
                          : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}번 ${p.name} 순서 핸들`}
                  accessibilityHint="길게 눌러 선택 후 다른 번호에 놓아 순서를 바꿉니다"
                >
                  <Text
                    style={[
                      styles.stripHandle,
                      {
                        color: dragging ? colors.chipOnFg : colors.textMuted,
                      },
                    ]}
                  >
                    ≡
                  </Text>
                  <Text
                    style={[
                      styles.stripNum,
                      {
                        color: dragging ? colors.chipOnFg : colors.chipFg,
                      },
                    ]}
                  >
                    {i + 1}
                  </Text>
                  <Text
                    style={[
                      styles.stripName,
                      {
                        color: dragging ? colors.chipOnFg : colors.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  map: { width: "100%", height: "100%" },
  stub: {
    height: "100%",
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  stubText: { fontSize: 12, textAlign: "center" },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224,242,254,0.55)",
  },
  emptyText: { fontSize: 12, fontWeight: "600" },
  keyHint: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(12,74,110,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keyHintText: { color: "#f0f9ff", fontSize: 10, fontWeight: "600" },
  customPin: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  customPinText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  reorderBar: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  reorderTitle: { fontSize: 12, fontWeight: "700" },
  reorderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  reorderBtn: {
    minWidth: 44,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnText: { fontSize: 16, fontWeight: "800" },
  reorderModeBtn: {
    minHeight: 40,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  reorderClose: {
    marginLeft: "auto",
    minHeight: 40,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  reorderCloseText: { fontSize: 12, fontWeight: "700" },
  stripWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
  },
  stripHint: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  stripRow: {
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
  },
  stripChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 140,
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  stripHandle: { fontSize: 14, fontWeight: "800", width: 14 },
  stripNum: { fontSize: 13, fontWeight: "900", minWidth: 14 },
  stripName: { fontSize: 11, fontWeight: "600", flexShrink: 1, maxWidth: 72 },
});
