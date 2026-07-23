import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { generateItinerary } from "./src/api/trip";
import { setApiClientBaseUrl } from "./src/api/client";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { OnboardingModal } from "./src/components/OnboardingModal";
import { ApiProvider, useApi } from "./src/context/ApiContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
} from "./src/storage/onboardingStorage";
import {
  createEmptyTrip,
  deleteTrip,
  duplicateTrip,
  loadTrips,
  upsertTrip,
} from "./src/storage/tripStorage";
import type { MvpCityId, Screen, Trip } from "./src/types";
import { tripCitiesLabel } from "./src/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { CreateTripScreen } from "./src/screens/CreateTripScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { CaptureScreen } from "./src/screens/CaptureScreen";
import { ExpensesScreen } from "./src/screens/ExpensesScreen";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

function AppInner() {
  const { apiBaseUrl, ready } = useApi();
  const { colors, isDark } = useTheme();
  const [screen, setScreen] = useState<Screen>("home");
  const [showSettings, setShowSettings] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [active, setActive] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setApiClientBaseUrl(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const [saved, seen] = await Promise.all([
          loadTrips(),
          hasSeenOnboarding(),
        ]);
        setTrips(saved);
        if (!seen) setShowOnboarding(true);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "초기화 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready]);

  const persist = useCallback(async (trip: Trip) => {
    setActive(trip);
    const next = await upsertTrip(trip);
    setTrips(next);
  }, []);

  const handleDeleteTrip = useCallback(
    async (trip: Trip) => {
      const next = await deleteTrip(trip.id);
      setTrips(next);
      if (active?.id === trip.id) {
        setActive(null);
        setScreen("home");
      }
    },
    [active?.id],
  );

  const handleDuplicateTrip = useCallback(async (trip: Trip) => {
    const next = await duplicateTrip(trip);
    setTrips(next);
    Alert.alert(
      "복제 완료",
      `${tripCitiesLabel(trip)} 여행 사본이 목록 맨 위에 추가되었습니다.`,
    );
  }, []);

  const finishOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void markOnboardingSeen();
  }, []);

  const handleCreate = useCallback(
    async (input: {
      cityId: MvpCityId;
      cityIds: MvpCityId[];
      nights: number;
      days: number;
      partySize: number;
    }) => {
      setGenerating(true);
      try {
        const result = await generateItinerary({
          cityId: input.cityId,
          cityIds: input.cityIds,
          nights: input.nights,
          days: input.days,
          partySize: input.partySize,
        });
        const trip = createEmptyTrip(input);
        const next: Trip = {
          ...trip,
          places: result.places,
          plannedBudget: result.plannedBudget,
          lodgingCandidates: result.lodgingCandidates ?? [],
          preferredLodgingId: result.preferredLodgingId ?? null,
          mapProvider: result.mapProvider ?? "google",
          cityId: result.cityId ?? input.cityId,
          cityName:
            result.cities && result.cities.length > 1
              ? result.cities.map((c) => c.cityName).join(" · ")
              : (result.cityId ?? input.cityId) === "osaka"
                ? "오사카"
                : "도쿄",
          cities: result.cities ?? trip.cities,
          status: "planning",
          updatedAt: new Date().toISOString(),
        };
        await persist(next);
        setScreen("plan");
        Alert.alert(
          "일정 생성",
          `${result.summary}\n엔진: ${result.engine} · ${result.places.length}곳` +
            (result.transportEngine
              ? `\n교통: ${result.transportEngine}`
              : ""),
        );
      } catch (e) {
        Alert.alert(
          "AI 일정 실패",
          e instanceof Error ? e.message : "설정에서 API 주소를 확인하세요.",
        );
      } finally {
        setGenerating(false);
      }
    },
    [persist],
  );

  const sdk = Constants.expoConfig?.sdkVersion ?? "?";

  if (bootError) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
        <Text style={[styles.bootErr, { color: colors.danger }]}>
          시작 오류: {bootError}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <OnboardingModal visible={showOnboarding} onDone={finishOnboarding} />
      {screen === "home" && !showSettings ? (
        <View style={styles.header}>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Expo SDK {sdk} · Android first
          </Text>
        </View>
      ) : null}

      {showSettings ? (
        <SettingsScreen onClose={() => setShowSettings(false)} />
      ) : null}

      {screen === "home" && (
        <HomeScreen
          trips={trips}
          loading={loading}
          onCreate={() => setScreen("create")}
          onOpen={(t) => {
            setActive(t);
            setScreen("plan");
          }}
          onSettings={() => setShowSettings(true)}
          onDelete={(t) => void handleDeleteTrip(t)}
          onDuplicate={(t) => void handleDuplicateTrip(t)}
        />
      )}
      {screen === "create" && (
        <CreateTripScreen
          generating={generating}
          onBack={() => setScreen("home")}
          onSubmit={(input) => void handleCreate(input)}
        />
      )}
      {screen === "plan" && active && (
        <PlanScreen
          trip={active}
          onChangeTrip={(t) => void persist(t)}
          onBack={() => {
            setActive(null);
            setScreen("home");
          }}
          onMap={() => setScreen("map")}
          onCapture={() => setScreen("capture")}
          onExpenses={() => setScreen("expenses")}
          onSummary={() => setScreen("summary")}
        />
      )}
      {screen === "map" && active && (
        <MapScreen trip={active} onBack={() => setScreen("plan")} />
      )}
      {screen === "capture" && active && (
        <CaptureScreen
          trip={active}
          onChangeTrip={(t) => void persist(t)}
          onBack={() => setScreen("plan")}
        />
      )}
      {screen === "expenses" && active && (
        <ExpensesScreen
          trip={active}
          onChangeTrip={(t) => void persist(t)}
          onBack={() => setScreen("plan")}
        />
      )}
      {screen === "summary" && active && (
        <SummaryScreen trip={active} onBack={() => setScreen("plan")} />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <ApiProvider>
              <AppInner />
            </ApiProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  header: { paddingTop: 4, paddingBottom: 4 },
  sub: { fontSize: 11 },
  bootErr: { padding: 16, fontSize: 16 },
});
