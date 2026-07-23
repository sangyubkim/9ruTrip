import { apiFetch } from "./client";
import type { ItineraryPlace } from "../types";

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

export async function checkHealth(): Promise<{
  ok: boolean;
  geminiConfigured?: boolean;
}> {
  const res = await apiFetch("/health");
  return (await res.json()) as { ok: boolean; geminiConfigured?: boolean };
}
