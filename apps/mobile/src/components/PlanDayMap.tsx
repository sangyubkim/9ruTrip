import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { ItineraryPlace, MvpCityId } from "../types";
import { getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";

type Props = {
  cityId: MvpCityId;
  places: ItineraryPlace[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
};

/** Plan 상단 압축 지도 — Day 마커, 선택 하이라이트 */
export function PlanDayMap({
  cityId,
  places,
  selectedPlaceId,
  onSelectPlace,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);

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

  if (mapCfg.providerId === "naver") {
    return (
      <View style={styles.stub}>
        <Text style={styles.stubText}>
          Naver Maps 스캐폴드 · 장소 {coords.length}곳
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
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
          const selected = p.id === selectedPlaceId;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={`${i + 1}. ${p.name}`}
              description={p.plannedTime ? `${p.plannedTime}` : undefined}
              pinColor={selected ? "#0284c7" : "#0c4a6e"}
              onPress={() => onSelectPlace?.(p.id)}
            />
          );
        })}
      </MapView>
      {coords.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>이 Day 장소 없음</Text>
        </View>
      ) : null}
      {!mapCfg.hasCredentials ? (
        <Pressable style={styles.keyHint} pointerEvents="none">
          <Text style={styles.keyHintText}>Maps 키 없음 · 기본 지도</Text>
        </Pressable>
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
    borderColor: "#bae6fd",
    backgroundColor: "#e0f2fe",
  },
  map: { width: "100%", height: "100%" },
  stub: {
    height: "100%",
    borderRadius: 14,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  stubText: { color: "#0369a1", fontSize: 12, textAlign: "center" },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224,242,254,0.55)",
  },
  emptyText: { color: "#0369a1", fontSize: 12, fontWeight: "600" },
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
});
