import React, { createContext, useContext, useEffect, useState } from "react";
import { setApiClientBaseUrl } from "../api/client";
import { DEFAULT_API_BASE_URL } from "../config";
import { loadApiBaseUrl, saveApiBaseUrl } from "../storage/settingsStorage";

type ApiContextValue = {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => Promise<void>;
  ready: boolean;
};

const ApiContext = createContext<ApiContextValue>({
  apiBaseUrl: DEFAULT_API_BASE_URL,
  setApiBaseUrl: async () => {},
  ready: false,
});

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [apiBaseUrl, setUrl] = useState(DEFAULT_API_BASE_URL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await loadApiBaseUrl();
      setUrl(saved);
      setApiClientBaseUrl(saved);
      setReady(true);
    })();
  }, []);

  const setApiBaseUrl = async (url: string) => {
    const cleaned = url.replace(/\/$/, "");
    await saveApiBaseUrl(cleaned);
    setUrl(cleaned);
    setApiClientBaseUrl(cleaned);
  };

  return (
    <ApiContext.Provider value={{ apiBaseUrl, setApiBaseUrl, ready }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  return useContext(ApiContext);
}
