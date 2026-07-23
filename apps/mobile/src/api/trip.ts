import { apiFetch } from "./client";
import type { ItineraryPlace, Trip } from "../types";

export type ItineraryRequest = {
  cityId: "tokyo";
  nights: number;
  days: number;
  partySize: number;
};

export type ItineraryResponse = {
  places: ItineraryPlace[];
  plannedBudget: number;
  summary: string;
  engine: string;
};

export async function generateItinerary(
  payload: ItineraryRequest,
): Promise<ItineraryResponse> {
  const res = await apiFetch("/trip/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ItineraryResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Itinerary failed: ${res.status}`);
  }
  return json;
}

export type RerouteRequest = {
  trip: Trip;
  dayIndex: number;
  reason?: string;
  completedPlaceIds?: string[];
};

export type RerouteResponse = {
  places: ItineraryPlace[];
  plannedBudget: number;
  summary: string;
  engine: string;
  dayIndex: number;
  replacedCount: number;
};

export async function rerouteTrip(payload: RerouteRequest): Promise<RerouteResponse> {
  const res = await apiFetch("/trip/reroute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RerouteResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Reroute failed: ${res.status}`);
  }
  return json;
}

export type ExportDraftResponse = {
  draft: {
    id: string;
    title: string;
    steps: { id: string; imageUri: string | null; caption: string; order: number }[];
    body: string;
    excerpt: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  next: { docsApi: string; note: string };
};

export async function exportTripDraft(trip: unknown): Promise<ExportDraftResponse> {
  const res = await apiFetch("/trip/export-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trip }),
  });
  const json = (await res.json()) as ExportDraftResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Export failed: ${res.status}`);
  }
  return json;
}

export type PublishRequest = {
  trip?: Trip;
  title?: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "publish";
  tags?: string[];
};

export type PublishResponse = {
  postId: number;
  link: string;
  editLink: string | null;
  featuredMediaId: number | null;
  tagIds: number[];
  seoApplied: boolean;
};

export async function publishTripToWordPress(
  payload: PublishRequest,
): Promise<PublishResponse> {
  const res = await apiFetch("/wordpress/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as PublishResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Publish failed: ${res.status}`);
  }
  return json;
}

export type ParseSmsResponse = {
  ok: boolean;
  amountKrw?: number;
  amountJpyEstimate?: number;
  merchant?: string;
  currencyHint?: string;
  error?: string;
  raw?: string;
};

export async function parseSmsExpense(text: string): Promise<ParseSmsResponse> {
  const res = await apiFetch("/trip/parse-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return (await res.json()) as ParseSmsResponse;
}

export async function checkHealth(): Promise<{
  ok: boolean;
  geminiConfigured?: boolean;
  wordpressConfigured?: boolean;
}> {
  const res = await apiFetch("/health");
  return (await res.json()) as {
    ok: boolean;
    geminiConfigured?: boolean;
    wordpressConfigured?: boolean;
  };
}
