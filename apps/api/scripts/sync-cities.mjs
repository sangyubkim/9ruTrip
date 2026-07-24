import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const src = fs.readFileSync(
  path.join(root, "apps/mobile/src/data/destinations.ts"),
  "utf8",
);

const cityRe =
  /city\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*([-\d.]+),\s*([-\d.]+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g;
const cities = {};
let m;
while ((m = cityRe.exec(src))) {
  const [
    ,
    id,
    nameKo,
    nameEn,
    countryId,
    currency,
    lat,
    lng,
    timezone,
    region,
    mapProvider,
  ] = m;
  cities[id] = {
    id,
    nameKo,
    nameEn,
    countryId,
    currency,
    center: { lat: Number(lat), lng: Number(lng) },
    timezone,
    region: region || "overseas",
    mapProvider: mapProvider || "google",
  };
}

const countryRe =
  /country\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*\[([^\]]+)\]\)/g;
const countries = [];
while ((m = countryRe.exec(src))) {
  const cityIds = m[5].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  countries.push({
    id: m[1],
    nameKo: m[2],
    nameEn: m[3],
    flag: m[4],
    cityIds,
  });
}

if (Object.keys(cities).length < 50) {
  console.error("Failed to parse cities", Object.keys(cities).length);
  process.exit(1);
}

const out = `/** Auto-generated from apps/mobile/src/data/destinations.ts — do not edit by hand */
export const DEFAULT_CITY_ID = "tokyo";

export const COUNTRIES = ${JSON.stringify(countries, null, 2)};

export const CITIES = ${JSON.stringify(cities, null, 2)};

export function isKnownCityId(id) {
  return Boolean(id && CITIES[id]);
}

export function resolveCity(cityId) {
  const key = isKnownCityId(cityId) ? cityId : DEFAULT_CITY_ID;
  const c = CITIES[key];
  const country = COUNTRIES.find((x) => x.id === c.countryId);
  return {
    id: c.id,
    nameKo: c.nameKo,
    nameEn: c.nameEn,
    countryId: c.countryId,
    countryNameKo: country?.nameKo || c.countryId,
    currency: c.currency,
    center: c.center,
    timezone: c.timezone,
    mapProvider: c.mapProvider || "google",
    region: c.region || "overseas",
  };
}

export function listCityIds() {
  return Object.keys(CITIES);
}
`;

const dest = path.join(root, "apps/api/lib/cities.mjs");
fs.writeFileSync(dest, out);
console.log(
  `wrote ${dest} (${Object.keys(cities).length} cities, ${countries.length} countries)`,
);
