// Fetch REAL RateMyProfessor school-level ratings for our seeded schools and
// cache them into lib/ratings.data.ts. Run occasionally (not at request time):
//   node scripts/fetch-rmp.mjs
//
// RMP has no official API; this uses the same GraphQL endpoint their site uses
// (public "test:test" token). It's unofficial + against RMP ToS, so we fetch
// ONCE and cache — the live app never calls RMP. For production, swap this for a
// licensed data source; lib/ratings.ts won't need to change.

import { writeFileSync } from "node:fs";

const ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const AUTH = "Basic dGVzdDp0ZXN0"; // public token the RMP site itself sends

// our schoolId -> how to find it on RMP. Usually a name + state (+ city to
// disambiguate). For schools RMP's search won't surface correctly, pin rmpId
// (the GraphQL node id) — verified by hand against the RMP page.
const TARGETS = [
  { id: "ut-austin", q: "University of Texas at Austin", state: "TX" },
  { id: "rice", q: "Rice University", state: "TX" },
  { id: "tamu", rmpId: "U2Nob29sLTEwMDM=", state: "TX" }, // "Texas A&M University at College Station" — search hides the flagship
  { id: "asu", q: "Arizona State University", state: "AZ", city: "Tempe" },
  { id: "colorado", q: "University of Colorado Boulder", state: "CO" },
  { id: "gatech", q: "Georgia Institute of Technology", state: "GA" },
  { id: "uw", q: "University of Washington", state: "WA", city: "Seattle" },
  { id: "olin", q: "Olin College of Engineering", state: "MA" },
  { id: "rit", q: "Rochester Institute of Technology", state: "NY" },
  { id: "mtu", q: "Michigan Technological University", state: "MI" },
  { id: "spelman", q: "Spelman College", state: "GA" },
  { id: "calpoly", q: "California Polytechnic State University", state: "CA", city: "San Luis Obispo" },
  { id: "purdue", q: "Purdue University", state: "IN", city: "West Lafayette" },
  { id: "northeastern", q: "Northeastern University", state: "MA", city: "Boston" },
  { id: "utah", q: "University of Utah", state: "UT", city: "Salt Lake City" },
  { id: "byu", q: "Brigham Young University", state: "UT", city: "Provo" },
  { id: "uvu", rmpId: "U2Nob29sLTE4NDU4", state: "UT" }, // main "Utah Valley University" (RMP lists blank city/state)
];

const SEARCH = `query($q: SchoolSearchQuery!){ newSearch { schools(query: $q) { edges { node { id name city state numRatings avgRatingRounded } } } } }`;
const SUMMARY = `query($id: ID!){ node(id: $id){ ... on School { id name city state numRatings avgRatingRounded summary { campusCondition campusLocation careerOpportunities clubAndEventActivities foodQuality internetSpeed libraryCondition schoolReputation schoolSafety schoolSatisfaction socialActivities } } } }`;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (n) => (n == null ? 0 : Math.round(n * 100) / 100);

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 200));
  return j.data;
}

// Pick the node that best matches our target (state + name + city, then size).
function pickBest(nodes, t) {
  const qn = norm(t.q);
  let best = null, bestScore = -Infinity;
  for (const n of nodes) {
    let score = 0;
    if (n.state === t.state) score += 5;
    const nn = norm(n.name);
    if (nn === qn) score += 4;
    else if (qn.split(" ").every((w) => nn.includes(w))) score += 2;
    else if (nn.includes(qn)) score += 6; // exact name as a substring (e.g. blank-city main campus)
    if (t.city && n.city && norm(n.city) === norm(t.city)) score += 3;
    if (/ at |global|online|school of /.test(n.name.toLowerCase())) score -= 4; // branch/online/sub-campus marker
    score += Math.min(2, (n.numRatings || 0) / 1000); // prefer the main campus
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

const out = {};
const report = [];
const fetchedAt = new Date().toISOString().slice(0, 10);

for (const t of TARGETS) {
  try {
    let nodeId = t.rmpId;
    if (!nodeId) {
      const d = await gql(SEARCH, { q: { text: t.q } });
      const nodes = (d.newSearch?.schools?.edges ?? []).map((e) => e.node);
      const hit = pickBest(nodes, t);
      if (!hit) { report.push(`✗ ${t.id}: no result`); continue; }
      nodeId = hit.id;
    }
    const sd = await gql(SUMMARY, { id: nodeId });
    const n = sd.node;
    const s = n.summary ?? {};
    out[t.id] = {
      schoolId: t.id, rmpId: nodeId, rmpName: n.name, source: "ratemyprofessors", fetchedAt,
      overall: r2(n.avgRatingRounded), reviewCount: n.numRatings ?? 0,
      reputation: r2(s.schoolReputation), opportunities: r2(s.careerOpportunities),
      happiness: r2(s.schoolSatisfaction), social: r2(s.socialActivities), safety: r2(s.schoolSafety),
      location: r2(s.campusLocation), facilities: r2(s.campusCondition), clubs: r2(s.clubAndEventActivities),
      food: r2(s.foodQuality), internet: r2(s.internetSpeed), library: r2(s.libraryCondition),
    };
    const flag = t.rmpId || n.state === t.state ? "" : "  ⚠ STATE MISMATCH";
    report.push(`✓ ${t.id.padEnd(13)} → ${n.name} (${n.city}, ${n.state})  ${out[t.id].overall}★  ${out[t.id].reviewCount} reviews${flag}`);
    await sleep(350); // be polite
  } catch (e) {
    report.push(`✗ ${t.id}: ${e.message}`);
  }
}

const header = `// AUTO-GENERATED by scripts/fetch-rmp.mjs on ${fetchedAt}. Do not edit by hand.
// Real RateMyProfessor school-level ratings, cached at build time. See lib/ratings.ts.
import type { RmpRating } from "./ratings";

export const RMP_RATINGS: Record<string, RmpRating> = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(new URL("../lib/ratings.data.ts", import.meta.url), header);

console.log(report.join("\n"));
console.log(`\nWrote ${Object.keys(out).length}/${TARGETS.length} schools → lib/ratings.data.ts`);
