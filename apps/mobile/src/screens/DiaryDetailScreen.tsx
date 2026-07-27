import { useEffect, useMemo, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { TravelDiaryEntry } from "../types";
import { getCityMeta } from "../types";
import { getMapViewConfig } from "../maps/provider";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
import { buildDiaryRouteSummaries } from "../utils/diary";

type Props = {
  entry: TravelDiaryEntry;
  onBack: () => void;
};

function dateRange(entry: TravelDiaryEntry) {
  if (!entry.startDate || !entry.endDate) {
    return `${entry.nights}박 ${entry.days}일 · ${entry.partySize}명`;
  }
  return `${entry.startDate} ~ ${entry.endDate} · ${entry.nights}박 ${entry.days}일 · ${entry.partySize}명`;
}

export function DiaryDetailScreen({ entry, onBack }: Props) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const places = useMemo(
    () =>
      [...(entry.places ?? [])]
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order),
    [entry.places],
  );
  const routeSummaries = useMemo(
    () => buildDiaryRouteSummaries(entry.places ?? []),
    [entry.places],
  );
  const cityId = entry.cityId || entry.cityIds[0] || "seoul";
  const city = getCityMeta(cityId);
  const mapCfg = getMapViewConfig(cityId);

  const region = useMemo(() => {
    if (places.length === 0) {
      return {
        latitude: city.center.lat,
        longitude: city.center.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    const lats = places.map((p) => p.lat);
    const lngs = places.map((p) => p.lng);
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
  }, [places, city.center.lat, city.center.lng]);

  const fitRoute = () => {
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
        edgePadding: { top: 48, right: 36, bottom: 48, left: 36 },
      },
    );
  };

  useEffect(() => {
    fitRoute();
  }, [places]);

  const outline =
    entry.routeOutline ||
    [
      entry.origin?.name,
      entry.cityNames.join(" · ") || entry.title,
      entry.endPoint?.name,
    ]
      .filter(Boolean)
      .join(" → ");

  const summariesByDay = useMemo(() => {
    const groups = new Map<number, typeof routeSummaries>();
    for (const leg of routeSummaries) {
      const list = groups.get(leg.dayIndex) ?? [];
      list.push(leg);
      groups.set(leg.dayIndex, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [routeSummaries]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Pressable
        onPress={onBack}
        style={styles.backHit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="다이어리 목록으로"
      >
        <Text style={[styles.back, { color: colors.accent }]}>← 다이어리</Text>
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
        완료한 다이어리
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>{entry.title}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {dateRange(entry)}
      </Text>
      {outline ? (
        <Text style={[styles.outline, { color: colors.textMuted }]}>
          {outline}
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.text }]}>지도</Text>
      {mapCfg.canMountNativeMap && places.length > 0 ? (
        <View
          style={[
            styles.mapWrap,
            { borderColor: colors.border, backgroundColor: colors.bgElevated },
          ]}
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={mapCfg.rnProvider}
            initialRegion={region}
            onMapReady={fitRoute}
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
            {places.map((p, i) => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={`${i + 1}. ${p.name}`}
                description={
                  p.plannedTime
                    ? `Day ${p.dayIndex + 1} · ${p.plannedTime}`
                    : `Day ${p.dayIndex + 1}`
                }
                accessibilityLabel={`${i + 1}번 ${p.name}`}
              >
                <View style={styles.pin}>
                  <Text style={styles.pinText}>{i + 1}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      ) : (
        <View
          style={[
            styles.mapStub,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.stubTitle, { color: colors.text }]}>
            {places.length === 0 ? "저장된 경로가 없습니다" : "지도를 표시할 수 없습니다"}
          </Text>
          <Text style={[styles.stubBody, { color: colors.textMuted }]}>
            {places.length === 0
              ? "이 다이어리에는 장소 좌표가 없어요. 이후 완료하는 여행부터 경로가 저장됩니다."
              : mapCfg.stubMessage ??
                "지도 키가 없어 목록만 표시합니다."}
          </Text>
          {places.map((p, i) => (
            <Text key={p.id} style={[styles.listItem, { color: colors.textSecondary }]}>
              {i + 1}. {p.name}
            </Text>
          ))}
        </View>
      )}
      {places.length > 0 ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          장소 {places.length}곳 · 경로 마커
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.text }]}>경로별 요약글</Text>
      {summariesByDay.length === 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            아직 경로 요약이 없습니다. 장소를 포함한 여행을 완료하면 여기에 Day별
            동선이 쌓입니다.
          </Text>
        </View>
      ) : (
        summariesByDay.map(([dayIndex, legs]) => (
          <View
            key={`day-${dayIndex}`}
            style={[
              styles.card,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              Day {dayIndex + 1}
            </Text>
            {legs.map((leg) => (
              <View key={leg.placeId} style={styles.leg}>
                <Text style={[styles.legTitle, { color: colors.text }]}>
                  {leg.orderLabel}. {leg.placeName}
                </Text>
                <Text style={[styles.legSummary, { color: colors.textSecondary }]}>
                  {leg.summary}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}

      <Text style={[styles.section, { color: colors.text }]}>여행 브리핑</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.accentMuted,
            borderColor: "transparent",
          },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.accent }]}>
          간략 브리핑
        </Text>
        <Text style={[styles.briefing, { color: colors.text }]}>
          {entry.briefing?.trim() ||
            "저장된 브리핑이 없습니다. 새로 만든 여행은 일정 생성 시 브리핑이 함께 기록됩니다."}
        </Text>
      </View>

      {entry.notes ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>메모</Text>
          <Text style={[styles.briefing, { color: colors.text }]}>{entry.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: space.xxl },
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  back: { fontSize: 15, fontWeight: "700" },
  eyebrow: { marginTop: space.sm, fontSize: 12, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3, marginTop: 4 },
  sub: { marginTop: space.sm, fontSize: 14, fontWeight: "600" },
  outline: { marginTop: space.sm, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  section: {
    marginTop: space.xl,
    marginBottom: space.sm,
    fontSize: 17,
    fontWeight: "800",
  },
  mapWrap: {
    height: 260,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  map: { width: "100%", height: "100%" },
  mapStub: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    minHeight: 160,
  },
  stubTitle: { fontWeight: "800", marginBottom: space.sm },
  stubBody: { fontSize: 13, lineHeight: 20 },
  listItem: { marginTop: 6, fontSize: 13 },
  pin: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#0369a1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  pinText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  meta: { marginTop: space.sm, fontSize: 12 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.sm,
  },
  cardLabel: { fontSize: 12, fontWeight: "800", marginBottom: space.sm },
  leg: { marginBottom: space.md },
  legTitle: { fontSize: 15, fontWeight: "800" },
  legSummary: { marginTop: 4, fontSize: 13, lineHeight: 20 },
  briefing: { fontSize: 15, lineHeight: 24, fontWeight: "600" },
  emptyBody: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
});
