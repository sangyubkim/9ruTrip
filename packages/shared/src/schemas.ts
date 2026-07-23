import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const itineraryRequestSchema = z.object({
  cityId: z.enum(["tokyo", "osaka"]),
  /** 멀티시티: 주 도시 외 추가 도시 (예: ["osaka"]) */
  cityIds: z.array(z.enum(["tokyo", "osaka"])).min(1).max(2).optional(),
  nights: z.number().int().min(1).max(14),
  days: z.number().int().min(1).max(15),
  partySize: z.number().int().min(1).max(12),
});

export type ItineraryRequest = z.infer<typeof itineraryRequestSchema>;

export const lodgingScoreBreakdownSchema = z.object({
  centrality: z.number(),
  priceEstimate: z.number(),
  ratingProxy: z.number(),
});

export const transportModeSchema = z.enum(["walking", "transit", "taxi"]);

export const transportOptionSchema = z.object({
  mode: transportModeSchema,
  minutes: z.number(),
  estimatedCost: z.number(),
  engine: z.string(),
  deepLink: z.string().optional(),
  deepLinks: z
    .object({
      google: z.string().optional(),
      yahoo: z.string().optional(),
    })
    .optional(),
  note: z.string().optional(),
});

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
  plannedTime: z.string().optional(),
  travelFromPrevMinutes: z.number().optional(),
  travelFromPrevCost: z.number().optional(),
  lodgingScore: z.number().optional(),
  scoreBreakdown: lodgingScoreBreakdownSchema.optional(),
  transportEngine: z.string().optional(),
  preferredTransportMode: transportModeSchema.optional(),
  transportOptions: z.array(transportOptionSchema).optional(),
  cityId: z.enum(["tokyo", "osaka"]).optional(),
});

export const tripCityLegSchema = z.object({
  cityId: z.enum(["tokyo", "osaka"]),
  cityName: z.string(),
  dayIndexes: z.array(z.number().int().min(0)),
});

export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  checked: z.boolean(),
});

export const lodgingCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.literal("hotel"),
  lat: z.number(),
  lng: z.number(),
  estimatedCost: z.number(),
  notes: z.string().optional(),
  lodgingScore: z.number(),
  scoreBreakdown: lodgingScoreBreakdownSchema,
});

export const itineraryResponseSchema = z.object({
  places: z.array(itineraryPlaceSchema),
  plannedBudget: z.number(),
  summary: z.string(),
  engine: z.string(),
  lodgingCandidates: z.array(lodgingCandidateSchema).optional(),
  preferredLodgingId: z.string().nullable().optional(),
  cityId: z.enum(["tokyo", "osaka"]).optional(),
  cities: z.array(tripCityLegSchema).optional(),
  mapProvider: z.enum(["google", "naver"]).optional(),
  transportEngine: z.string().optional(),
});

export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
