import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import type { Trip } from "../types";
import { MVP_CITY } from "../types";
import { getGoogleMapsKey } from "../config";

type Props = {
  trip: Trip;
  onBack: () => void;
};

export function MapScreen({ trip, onBack }: Props) {
  const places = useMemo(
    () => trip.places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [trip.places],
  );

  const hasKey = Boolean(getGoogleMapsKey());
  const region = {
    latitude: places[0]?.lat ?? MVP_CITY.center.lat,
    longitude: places[0]?.lng ?? MVP_CITY.center.lng,
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
        Google Maps (해외 MVP)
        {!hasKey
          ? " · EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 미설정 — 기기 기본 지도/제한 모드일 수 있음"
          : ""}
      </Text>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
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
});
