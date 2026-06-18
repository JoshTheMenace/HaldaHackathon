// Lightweight geo so "distance fit" is real, not faked. Coordinates are
// approximate city centroids — plenty for a relative distance signal.

type LatLng = { lat: number; lng: number };

export const SCHOOL_COORDS: Record<string, LatLng> = {
  "ut-austin": { lat: 30.2849, lng: -97.7341 },
  rice: { lat: 29.7174, lng: -95.4018 },
  tamu: { lat: 30.618, lng: -96.3344 },
  asu: { lat: 33.4242, lng: -111.928 },
  colorado: { lat: 40.0076, lng: -105.2659 },
  gatech: { lat: 33.7756, lng: -84.3963 },
  uw: { lat: 47.6553, lng: -122.3035 },
  olin: { lat: 42.2929, lng: -71.2639 },
  rit: { lat: 43.0848, lng: -77.6743 },
  mtu: { lat: 47.1192, lng: -88.5475 },
  spelman: { lat: 33.745, lng: -84.412 },
  calpoly: { lat: 35.3005, lng: -120.6625 },
  purdue: { lat: 40.4237, lng: -86.9212 },
  northeastern: { lat: 42.3398, lng: -71.0892 },
  utah: { lat: 40.7649, lng: -111.8421 },
  byu: { lat: 40.2518, lng: -111.6493 },
  uvu: { lat: 40.2783, lng: -111.7134 },
};

// State centroids — fallback when we only know the student's state.
const STATE_COORDS: Record<string, LatLng> = {
  TX: { lat: 31.0, lng: -99.0 },
  CA: { lat: 36.7, lng: -119.7 },
  AZ: { lat: 34.0, lng: -111.7 },
  CO: { lat: 39.0, lng: -105.5 },
  GA: { lat: 32.6, lng: -83.4 },
  WA: { lat: 47.4, lng: -120.5 },
  MA: { lat: 42.2, lng: -71.8 },
  NY: { lat: 42.9, lng: -75.5 },
  MI: { lat: 44.3, lng: -85.4 },
  IN: { lat: 39.9, lng: -86.3 },
  FL: { lat: 28.6, lng: -81.5 },
  IL: { lat: 40.0, lng: -89.0 },
  UT: { lat: 39.3, lng: -111.7 },
};

// A few zip3 anchors so a typed ZIP resolves to a real point (demo-friendly).
const ZIP3_COORDS: Record<string, LatLng & { city: string; state: string }> = {
  "787": { lat: 30.2672, lng: -97.7431, city: "Austin", state: "TX" },
  "770": { lat: 29.7604, lng: -95.3698, city: "Houston", state: "TX" },
  "752": { lat: 32.7767, lng: -96.797, city: "Dallas", state: "TX" },
  "846": { lat: 40.2338, lng: -111.6585, city: "Provo", state: "UT" },
  "841": { lat: 40.7608, lng: -111.891, city: "Salt Lake City", state: "UT" },
  "load": { lat: 0, lng: 0, city: "", state: "" },
};

export function resolveZip(
  zip?: string,
  state?: string
): (LatLng & { city?: string; state?: string }) | null {
  if (zip && zip.length >= 3) {
    const hit = ZIP3_COORDS[zip.slice(0, 3)];
    if (hit) return hit;
  }
  if (state && STATE_COORDS[state]) return STATE_COORDS[state];
  return null;
}

// US state name → USPS abbreviation, so "stay in Utah" reliably yields state="UT".
const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};
const ABBRS = new Set(Object.values(STATE_ABBR));

// Pull a state abbreviation out of free text, e.g. "I want to stay in Utah" → "UT".
export function stateFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const lc = text.toLowerCase();
  for (const [name, abbr] of Object.entries(STATE_ABBR)) {
    if (new RegExp(`\\b${name}\\b`).test(lc)) return abbr;
  }
  const m = text.match(/\b([A-Z]{2})\b/);
  if (m && ABBRS.has(m[1])) return m[1];
  return undefined;
}

// Strict: only matches a fully spelled-out state name. Safe for passive capture
// on arbitrary chat text, where the bare 2-letter form would mistake common
// words for abbreviations ("OK thanks" → OK, "hi" → HI, "I'm in" → IN).
export function stateNameFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const lc = text.toLowerCase();
  for (const [name, abbr] of Object.entries(STATE_ABBR)) {
    if (new RegExp(`\\b${name}\\b`).test(lc)) return abbr;
  }
  return undefined;
}

export function haversineMi(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
