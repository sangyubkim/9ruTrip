import { z } from "zod";

const cityIdSchema = z.string().min(1).max(64);

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const itineraryRequestSchema = z.object({
  cityId: cityIdSchema,
  cityIds: z.array(cityIdSchema).min(1).max(2).optional(),
  nights: z.number().int().min(1).max(14),
  days: z.number().int().min(1).max(15),
  partySize: z.number().int().min(1).max(12),
  origin: z
    .object({
      name: z.string(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      placeId: z.string().optional(),
      query: z.string().optional(),
    })
    .nullable()
    .optional(),
  endPoint: z
    .object({
      name: z.string(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      placeId: z.string().optional(),
      query: z.string().optional(),
    })
    .nullable()
    .optional(),
  stopoverCityIds: z.array(cityIdSchema).max(3).optional(),
  cityWeights: z.array(z.number()).max(2).optional(),
  preferences: z
    .object({
      food: z.number().min(1).max(5),
      attraction: z.number().min(1).max(5),
      activity: z.number().min(1).max(5),
      cost: z.number().min(1).max(5),
      minTravel: z.number().min(1).max(5),
    })
    .optional(),
  mainRequest: z.string().max(800).optional(),
  extraRequest: z.string().max(800).optional(),
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
  cityId: cityIdSchema.optional(),
});

export const tripCityLegSchema = z.object({
  cityId: cityIdSchema,
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
  cityId: cityIdSchema.optional(),
  cities: z.array(tripCityLegSchema).optional(),
  mapProvider: z.enum(["google", "naver"]).optional(),
  transportEngine: z.string().optional(),
  briefing: z.string().optional(),
  routeOutline: z.string().optional(),
});

export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
