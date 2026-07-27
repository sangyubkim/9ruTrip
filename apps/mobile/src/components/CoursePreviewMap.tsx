import { useMemo, useRef } from "react";
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
};

/**
 * 코스 상세 미리보기용 단일 지도 (마커 + 순서 polyline).
 * 목록 카드에는 마운트하지 않음.
 */
export function CoursePreviewMap({ cityId, waypoints }: Props) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);

  const coords = useMemo(
    () =>
      (waypoints || []).filter(
        (w) => Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)),
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

  if (mapCfg.providerId === "naver" || !mapCfg.canMountNativeMap) {
    return (
      <View style={[styles.stub, { borderColor: colors.mapBorder }]}>
        <Text style={[styles.stubText, { color: colors.accent }]}>
          {mapCfg.providerId === "naver"
            ? `Naver Maps 스캐폴드 · 경유 ${coords.length}곳`
            : `지도 키 없음 · 경유 ${coords.length}곳`}
        </Text>
        {coords.slice(0, 8).map((p, i) => (
          <Text
            key={`${p.contentId || p.name}-${i}`}
            style={[styles.stubItem, { color: colors.text }]}
            numberOfLines={1}
          >
            {p.order || i + 1}. {p.name}
          </Text>
        ))}
      </View>
    );
  }

  const pinColor = isDark ? "#38bdf8" : "#0284c7";
  const lineColor = isDark ? "#7dd3fc" : "#0369a1";

  return (
    <View
      style={[
        styles.wrap,
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
      >
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={lineColor}
            strokeWidth={3}
          />
        ) : null}
        {coords.map((p, i) => (
          <Marker
            key={`${p.contentId || p.name}-${i}`}
            coordinate={{
              latitude: Number(p.lat),
              longitude: Number(p.lng),
            }}
            title={`${p.order || i + 1}. ${p.name}`}
            pinColor={pinColor}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  map: { flex: 1 },
  stub: {
    minHeight: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: 4,
  },
  stubText: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  stubItem: { fontSize: 13, fontWeight: "600" },
});
