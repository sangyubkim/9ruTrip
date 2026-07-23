import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  /** 마커 탭 후 순서 ▲▼ 로 당일 순서 변경 */
  onMoveInDay?: (placeId: string, direction: "up" | "down") => void;
};

/** Plan 상단 압축 지도 — Day 마커, 선택 하이라이트, 순서 변경 오버레이 */
export function PlanDayMap({
  cityId,
  places,
  selectedPlaceId,
  onSelectPlace,
  onMoveInDay,
}: Props) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);
  const [reorderId, setReorderId] = useState<string | null>(null);

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

  const handleMarkerPress = (placeId: string) => {
    onSelectPlace?.(placeId);
    setReorderId(placeId);
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

  return (
    <View
      style={[
        styles.wrap,
        { borderColor: colors.mapBorder, backgroundColor: colors.accentMuted },
      ]}
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
            strokeColor="#0369a1"
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {coords.map((p, i) => {
          const selected = p.id === selectedPlaceId || p.id === reorderId;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={`${i + 1}. ${p.name}`}
              description={p.plannedTime ? `${p.plannedTime}` : undefined}
              pinColor={selected ? "#0284c7" : "#0c4a6e"}
              onPress={() => handleMarkerPress(p.id)}
              accessibilityLabel={`${i + 1}번 ${p.name} 마커`}
            />
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
      {reorderPlace && onMoveInDay ? (
        <View
          style={[
            styles.reorderBar,
            { backgroundColor: colors.undoBg },
          ]}
          accessibilityRole="toolbar"
          accessibilityLabel="마커 순서 변경"
        >
          <Text
            style={[styles.reorderTitle, { color: colors.undoFg }]}
            numberOfLines={1}
          >
            순서 변경 · {reorderIndex + 1}. {reorderPlace.name}
          </Text>
          <View style={styles.reorderActions}>
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
              <Text style={[styles.reorderBtnText, { color: colors.undoFg }]}>
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
              <Text style={[styles.reorderBtnText, { color: colors.undoFg }]}>
                ▼
              </Text>
            </Pressable>
            <Pressable
              style={styles.reorderClose}
              onPress={() => setReorderId(null)}
              accessibilityRole="button"
              accessibilityLabel="순서 변경 닫기"
            >
              <Text style={[styles.reorderCloseText, { color: colors.undoFg }]}>
                닫기
              </Text>
            </Pressable>
          </View>
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
    borderWidth: 1,
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
  reorderClose: {
    marginLeft: "auto",
    minHeight: 40,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  reorderCloseText: { fontSize: 12, fontWeight: "700" },
});
