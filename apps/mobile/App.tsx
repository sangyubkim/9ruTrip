import { useCallback, useEffect, useState } from "react";
import { Alert, BackHandler, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { space } from "./src/theme/tokens";
import Constants from "expo-constants";
import { generateItinerary } from "./src/api/trip";
import { setApiClientBaseUrl } from "./src/api/client";
import { ensureOvernightHotelsInPlaces } from "./src/utils/overnightHotels";
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
import type { Screen, Trip } from "./src/types";
import {
  buildCityLegs,
  buildRouteOutline,
  getCityMeta,
  isDomesticCityId,
  tripCitiesLabel,
} from "./src/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { TripTypeScreen } from "./src/screens/TripTypeScreen";
import {
  CreateTripScreen,
  type CreateTripInput,
} from "./src/screens/CreateTripScreen";
import { BriefingScreen } from "./src/screens/BriefingScreen";
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
  const [mapDayIndex, setMapDayIndex] = useState<number | undefined>();

  useEffect(() => {
    setApiClientBaseUrl(apiBaseUrl);
  }, [apiBaseUrl]);

  /** 소프트 백버튼 → 이전 화면 (홈에서만 앱 종료) */
  useEffect(() => {
    const onHardwareBack = () => {
      if (showOnboarding) return true;
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (screen === "home") return false;
      if (screen === "tripType") {
        setScreen("home");
        return true;
      }
      if (screen === "create") {
        setScreen("tripType");
        return true;
      }
      if (screen === "briefing") {
        setScreen("create");
        return true;
      }
      if (screen === "plan") {
        setActive(null);
        setScreen("home");
        return true;
      }
      if (
        screen === "map" ||
        screen === "capture" ||
        screen === "expenses" ||
        screen === "summary"
      ) {
        setScreen("plan");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBack,
    );
    return () => sub.remove();
  }, [screen, showSettings, showOnboarding]);

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
    async (input: CreateTripInput) => {
      setGenerating(true);
      try {
        const origin =
          input.startAddress || input.startLat != null
            ? {
                name: input.startAddress || "현재 위치",
                address: input.startAddress,
                lat: input.startLat,
                lng: input.startLng,
              }
            : null;
        const result = await generateItinerary({
          cityId: input.cityId,
          cityIds: input.cityIds,
          nights: input.nights,
          days: input.days,
          partySize: input.partySize,
          origin,
          startAddress: input.startAddress,
          startLat: input.startLat,
          startLng: input.startLng,
          startTime: input.startTime,
          outboundTransportMode: input.outboundTransportMode,
          userRequest: input.userRequest,
          mainRequest: input.userRequest,
        });
        const inputCityIds =
          input.cityIds?.length > 0 ? input.cityIds : [input.cityId];
        const inputDomestic = inputCityIds.every(isDomesticCityId);
        // 구 API/모델이 도쿄 일정을 주면 저장하지 않고 실패 처리
        const apiOverseasMismatch =
          inputDomestic &&
          ((result.cityId && !isDomesticCityId(result.cityId)) ||
            (result.cities ?? []).some((c) => !isDomesticCityId(c.cityId)) ||
            /도쿄|오사카|교토|tokyo|osaka/i.test(
              `${result.briefing || ""} ${result.summary || ""}`,
            ) ||
            (result.places ?? []).filter((p) => Number(p.lng) > 132).length >=
              Math.ceil((result.places?.length || 0) / 2));
        if (apiOverseasMismatch) {
          throw new Error(
            "서버가 해외(일본) 일정을 반환했습니다. API를 최신 코드로 재시작한 뒤 다시 시도해 주세요.",
          );
        }
        const resolvedCityId = result.cityId ?? input.cityId;
        const cities =
          result.cities ?? buildCityLegs(inputCityIds, input.days);
        const cityName =
          cities.length > 1
            ? cities.map((c) => c.cityName).join(" · ")
            : getCityMeta(resolvedCityId).nameKo;
        const routeOutline =
          result.routeOutline ||
          buildRouteOutline({
            origin,
            cityIds: inputCityIds,
          });
        const briefing = result.briefing || result.summary;
        const trip = createEmptyTrip({
          ...input,
          cityId: resolvedCityId,
          cityIds: inputCityIds,
          origin,
          mainRequest: input.userRequest,
          briefing,
          routeOutline,
        });
        // 구 API/AI가 숙소를 빠뜨려도 마지막 날 제외 Day에 hotel 보정
        const placesWithHotels = ensureOvernightHotelsInPlaces(
          result.places ?? [],
          {
            days: input.days,
            nights: input.nights,
            lodgingCandidates: result.lodgingCandidates,
            preferredLodgingId: result.preferredLodgingId,
            cityId: resolvedCityId,
            lodgingReturnTime: trip.lodgingReturnTime,
          },
        );
        const next: Trip = {
          ...trip,
          places: placesWithHotels,
          plannedBudget: result.plannedBudget,
          lodgingCandidates: result.lodgingCandidates ?? [],
          preferredLodgingId: result.preferredLodgingId ?? null,
          mapProvider:
            result.mapProvider ?? getCityMeta(resolvedCityId).mapProvider,
          cityId: resolvedCityId,
          cityName,
          cities,
          briefing,
          routeOutline,
          startAddress: input.startAddress,
          startLat: input.startLat,
          startLng: input.startLng,
          startTime: input.startTime,
          outboundTransportMode: input.outboundTransportMode || "car",
          userRequest: input.userRequest,
          status: "planning",
          updatedAt: new Date().toISOString(),
        };
        await persist(next);
        setScreen("briefing");
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
      edges={["top", "left", "right", "bottom"]}
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
          onCreate={() => setScreen("tripType")}
          onOpen={(t) => {
            setActive(t);
            setScreen("plan");
          }}
          onSettings={() => setShowSettings(true)}
          onDelete={(t) => void handleDeleteTrip(t)}
          onDuplicate={(t) => void handleDuplicateTrip(t)}
        />
      )}
      {screen === "tripType" && (
        <TripTypeScreen
          onBack={() => setScreen("home")}
          onSelectDomestic={() => setScreen("create")}
        />
      )}
      {screen === "create" && (
        <CreateTripScreen
          generating={generating}
          onBack={() => setScreen("tripType")}
          onSubmit={(input) => void handleCreate(input)}
        />
      )}
      {screen === "briefing" && active && (
        <BriefingScreen
          trip={active}
          onBack={() => setScreen("create")}
          onContinue={() => setScreen("plan")}
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
          onMap={(dayIndex) => {
            setMapDayIndex(dayIndex);
            setScreen("map");
          }}
          onCapture={() => setScreen("capture")}
          onExpenses={() => setScreen("expenses")}
          onSummary={() => setScreen("summary")}
        />
      )}
      {screen === "map" && active && (
        <MapScreen
          trip={active}
          dayIndex={mapDayIndex}
          onBack={() => setScreen("plan")}
        />
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
  root: { flex: 1, paddingHorizontal: space.lg },
  header: { paddingTop: space.xs, paddingBottom: space.xs },
  sub: { fontSize: 11 },
  bootErr: { padding: space.lg, fontSize: 16 },
});
