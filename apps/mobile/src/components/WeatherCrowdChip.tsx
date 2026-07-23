import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { MvpCityId } from "../types";
import { getCityMeta } from "../types";
import { useTheme } from "../theme/ThemeContext";
import {
  crowdHintForHour,
  fetchCityWeather,
  type WeatherSnapshot,
} from "../utils/weather";

type Props = {
  cityId: MvpCityId;
};

/** Plan/Active용 날씨·혼잡 칩 (Open-Meteo) */
export function WeatherCrowdChip({ cityId }: Props) {
  const { colors } = useTheme();
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const city = getCityMeta(cityId);
    setLoading(true);
    void fetchCityWeather(city.center.lat, city.center.lng).then((w) => {
      if (!cancelled) {
        setSnap(w);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const crowd = snap?.crowdHint ?? crowdHintForHour();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.accentMuted, borderColor: colors.mapBorder },
      ]}
      accessibilityRole="text"
      accessibilityLabel={
        snap
          ? `${snap.label}. ${crowd}`
          : `날씨 로딩. ${crowd}`
      }
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={[styles.weather, { color: colors.accent }]}>
          {snap?.label ?? "오늘 날씨"}
        </Text>
      )}
      <Text style={[styles.crowd, { color: colors.textSecondary }]}>
        · {crowd}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 36,
  },
  weather: { fontSize: 12, fontWeight: "800" },
  crowd: { fontSize: 12, fontWeight: "600" },
});
