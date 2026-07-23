import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const itineraryRequestSchema = z.object({
  cityId: z.literal("tokyo"),
  nights: z.number().int().min(1).max(14),
  days: z.number().int().min(1).max(15),
  partySize: z.number().int().min(1).max(12),
});

export type ItineraryRequest = z.infer<typeof itineraryRequestSchema>;

export const itineraryPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["attraction", "food", "hotel", "transport", "other"]),
  lat: z.number(),
  lng: z.number(),
  estimatedCost: z.number(),
  notes: z.string().optional(),
  dayIndex: z.number().int().min(0),
  order: z.number().int().min(0),
});

export const itineraryResponseSchema = z.object({
  places: z.array(itineraryPlaceSchema),
  plannedBudget: z.number(),
  summary: z.string(),
  engine: z.string(),
});

export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
