import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { TourCourseWaypoint } from "../api/trip";
import type { MvpCityId } from "../types";
import { getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  cityId: MvpCityId;
  waypoints: TourCourseWaypoint[];
  /** 기본 200. fullscreen 모달에서는 "flex" */
  height?: number | "flex";
};

/**
 * 코스 미리보기/동선 확인용 지도.
 * 좌표 있는 경유지에 번호 마커 + polyline. canMountNativeMap 없으면 stub.
 */
export function CoursePreviewMap({
  cityId,
  waypoints,
  height = 200,
}: Props) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);
  const fillFlex = height === "flex";

  // Keep list position for pin labels (API order/subnum can duplicate).
  // Filter after numbering so map pins match accordion 1..N even if some lack coords.
  const coords = useMemo(
    () =>
      (waypoints || [])
        .map((w, index) => ({ ...w, displayIndex: index + 1 }))
        .filter(
          (w) =>
            Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)),
        ),
    [waypoints],
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
    const lats = coords.map((p) => Number(p.lat));
    const lngs = coords.map((p) => Number(p.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.6 || 0.06),
      longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.6 || 0.06),
    };
  }, [coords, city.center.lat, city.center.lng]);

  const polylineCoords = useMemo(
    () =>
      coords.map((p) => ({
        latitude: Number(p.lat),
        longitude: Number(p.lng),
      })),
    [coords],
  );

  const fitRoute = () => {
    if (!mapRef.current || coords.length === 0) return;
    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: Number(coords[0].lat),
          longitude: Number(coords[0].lng),
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        0,
      );
      return;
    }
    mapRef.current.fitToCoordinates(polylineCoords, {
      animated: false,
      edgePadding: { top: 72, right: 40, bottom: 72, left: 40 },
    });
  };

  useEffect(() => {
    fitRoute();
  }, [coords.length, polylineCoords]);

  const pinBg = isDark ? "#0284c7" : "#0369a1";
  const lineColor = isDark ? "#7dd3fc" : "#0369a1";

  if (mapCfg.providerId === "naver" || !mapCfg.canMountNativeMap) {
    return (
      <View
        style={[
          styles.stub,
          fillFlex ? styles.flexFill : { minHeight: typeof height === "number" ? height : 140 },
          { borderColor: colors.mapBorder, backgroundColor: colors.bgElevated },
        ]}
      >
        <Text style={[styles.stubText, { color: colors.accent }]}>
          {mapCfg.providerId === "naver"
            ? `Naver Maps 스캐폴드 · 경유 ${coords.length}곳`
            : `지도 키 없음 · 경유 ${coords.length}곳`}
        </Text>
        <Text style={[styles.stubHint, { color: colors.textMuted }]}>
          {mapCfg.stubMessage ??
            "좌표가 있는 경유지만 번호 순서로 표시합니다."}
        </Text>
        {coords.map((p, i) => {
          const n = p.displayIndex;
          return (
            <Text
              key={`${p.contentId || p.name}-${i}`}
              style={[styles.stubItem, { color: colors.text }]}
              numberOfLines={1}
            >
              {n}. {p.name}
            </Text>
          );
        })}
        {coords.length === 0 ? (
          <Text style={[styles.stubHint, { color: colors.textMuted }]}>
            표시할 좌표가 없습니다.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        fillFlex ? styles.flexFill : { height: typeof height === "number" ? height : 200 },
        { borderColor: colors.mapBorder, backgroundColor: colors.accentMuted },
      ]}
      accessibilityLabel="추천 코스 지도"
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapCfg.rnProvider}
        initialRegion={region}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={fitRoute}
      >
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={lineColor}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {coords.map((p, i) => {
          const n = p.displayIndex;
          return (
            <Marker
              key={`${p.contentId || p.name}-${i}`}
              coordinate={{
                latitude: Number(p.lat),
                longitude: Number(p.lng),
              }}
              title={`${n}. ${p.name}`}
              description={p.address || p.overview || undefined}
              accessibilityLabel={`${n}번 ${p.name}`}
            >
              <View style={[styles.pin, { backgroundColor: pinBg }]}>
                <Text style={styles.pinText}>{n}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  flexFill: { flex: 1 },
  map: { flex: 1, width: "100%" },
  stub: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: 4,
  },
  stubText: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  stubHint: { fontSize: 12, lineHeight: 18, marginBottom: 4 },
  stubItem: { fontSize: 13, fontWeight: "600" },
  pin: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  pinText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
});
