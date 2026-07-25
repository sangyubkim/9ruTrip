import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { Trip } from "../types";
import { cityIdForDay, getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";

type Props = {
  trip: Trip;
  dayIndex?: number;
  onBack: () => void;
};

export function MapScreen({ trip, dayIndex, onBack }: Props) {
  const mapRef = useRef<MapView>(null);
  const places = useMemo(
    () =>
      trip.places.filter(
        (p) =>
          (dayIndex == null || p.dayIndex === dayIndex) &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      ),
    [dayIndex, trip.places],
  );

  const mapCityId = dayIndex == null ? trip.cityId : cityIdForDay(trip, dayIndex);
  const city = getCityMeta(mapCityId);
  const mapCfg = getMapViewConfig(mapCityId);
  const region = {
    latitude: places[0]?.lat ?? city.center.lat,
    longitude: places[0]?.lng ?? city.center.lng,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };
  const fitDayRoute = () => {
    if (!mapRef.current || places.length === 0) return;
    if (places.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: places[0].lat,
          longitude: places[0].lng,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        0,
      );
      return;
    }
    mapRef.current.fitToCoordinates(
      places.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      {
        animated: false,
        edgePadding: { top: 72, right: 40, bottom: 72, left: 40 },
      },
    );
  };

  useEffect(() => {
    fitDayRoute();
  }, [dayIndex, places]);

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>
        지도 · {dayIndex == null ? trip.cityName : `Day ${dayIndex + 1} · ${city.nameKo}`}
      </Text>
      <Text style={styles.hint}>
        {mapCfg.providerId === "google" ? "Google Maps" : "Naver Maps"} (
        {trip.mapProvider || mapCfg.providerId})
        {mapCfg.stubMessage ? ` · ${mapCfg.stubMessage}` : ""}
      </Text>

      {mapCfg.providerId === "naver" || !mapCfg.canMountNativeMap ? (
        <View style={styles.stub}>
          <Text style={styles.stubTitle}>
            {mapCfg.providerId === "naver"
              ? "Naver Maps 스캐폴드"
              : "지도 키 없음"}
          </Text>
          <Text style={styles.stubBody}>
            {mapCfg.providerId === "naver"
              ? "국내 도시는 Naver Maps 어댑터를 사용합니다. "
              : ""}
            {mapCfg.stubMessage ??
              "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY를 apps/mobile/.env에 넣고 APK를 재빌드하세요."}
          </Text>
          <Text style={styles.count}>장소 {places.length}곳 (목록만)</Text>
          {places.map((p) => (
            <Text key={p.id} style={styles.listItem}>
              · {p.name}
            </Text>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={mapCfg.rnProvider}
              initialRegion={region}
              onMapReady={fitDayRoute}
            >
              {places.length >= 2 ? (
                <Polyline
                  coordinates={places.map((p) => ({
                    latitude: p.lat,
                    longitude: p.lng,
                  }))}
                  strokeColor="#0369a1"
                  strokeWidth={3}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : null}
              {places.map((p) => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  title={p.name}
                  description={`Day ${p.dayIndex + 1}`}
                />
              ))}
            </MapView>
          </View>
          <Text style={styles.count}>{places.length}개 장소 마커</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  hint: { marginTop: 4, marginBottom: 10, fontSize: 12, color: "#64748b" },
  mapWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  map: { width: "100%", height: "100%" },
  count: { marginTop: 8, color: "#64748b", fontSize: 13 },
  stub: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stubTitle: { fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  stubBody: { color: "#475569", fontSize: 13, lineHeight: 20 },
  listItem: { marginTop: 4, color: "#334155", fontSize: 13 },
});
