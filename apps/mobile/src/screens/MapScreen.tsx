import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Trip } from "../types";
import { getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";

type Props = {
  trip: Trip;
  onBack: () => void;
};

export function MapScreen({ trip, onBack }: Props) {
  const places = useMemo(
    () => trip.places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [trip.places],
  );

  const city = getCityMeta(trip.cityId);
  const mapCfg = getMapViewConfig(trip.cityId);
  const region = {
    latitude: places[0]?.lat ?? city.center.lat,
    longitude: places[0]?.lng ?? city.center.lng,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>지도 · {trip.cityName}</Text>
      <Text style={styles.hint}>
        {mapCfg.providerId === "google" ? "Google Maps" : "Naver Maps"} (
        {trip.mapProvider || mapCfg.providerId})
        {mapCfg.stubMessage ? ` · ${mapCfg.stubMessage}` : ""}
      </Text>

      {mapCfg.providerId === "naver" ? (
        <View style={styles.stub}>
          <Text style={styles.stubTitle}>Naver Maps 스캐폴드</Text>
          <Text style={styles.stubBody}>
            국내 도시용 어댑터가 준비되어 있습니다. 도쿄/오사카는 Google을
            사용합니다. {mapCfg.stubMessage}
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
              style={styles.map}
              provider={mapCfg.rnProvider}
              initialRegion={region}
            >
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
