import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import {
  loadThemeMode,
  saveThemeMode,
} from "../storage/settingsStorage";
import {
  darkTokens,
  lightTokens,
  type ColorTokens,
  type ThemeMode,
} from "./tokens";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: ColorTokens;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  setMode: async () => {},
  isDark: false,
  colors: lightTokens,
  ready: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await loadThemeMode();
      setModeState(saved);
      setReady(true);
    })();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await saveThemeMode(next);
  }, []);

  const isDark = useMemo(() => {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return (system ?? Appearance.getColorScheme()) === "dark";
  }, [mode, system]);

  const colors = isDark ? darkTokens : lightTokens;

  const value = useMemo(
    () => ({ mode, setMode, isDark, colors, ready }),
    [mode, setMode, isDark, colors, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
