// Fetch a campus photo + logo for each seeded school from Wikipedia/Wikimedia
// and cache them under public/schools/. Run occasionally (not at request time):
//   node scripts/fetch-school-media.mjs
//
// Campus photo  -> <id>-campus.jpg  (main image on cards)
// Logo / seal   -> <id>-logo.png    (small badge)
// All from Wikimedia Commons (mostly CC-licensed). The app serves the cached
// copies so the live demo never hits the network.

import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/schools/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// id -> Wikipedia article title (+ optional hand-picked campus file for a sure thing)
const SCHOOLS = [
  { id: "ut-austin", title: "University of Texas at Austin" },
  { id: "rice", title: "Rice University" },
  { id: "tamu", title: "Texas A&M University" },
  { id: "asu", title: "Arizona State University" },
  { id: "colorado", title: "University of Colorado Boulder" },
  { id: "gatech", title: "Georgia Institute of Technology" },
  { id: "uw", title: "University of Washington" },
  { id: "olin", title: "Franklin W. Olin College of Engineering" },
  { id: "rit", title: "Rochester Institute of Technology" },
  { id: "mtu", title: "Michigan Technological University" },
  { id: "spelman", title: "Spelman College" },
  { id: "calpoly", title: "California Polytechnic State University" },
  { id: "purdue", title: "Purdue University" },
  { id: "northeastern", title: "Northeastern University" },
  { id: "utah", title: "University of Utah" },
  { id: "byu", title: "Brigham Young University", campus: "BYU_Campus_North.jpg" },
  { id: "uvu", title: "Utah Valley University" },
];

const UA = { "User-Agent": "HaldaDemo/1.0 (hackathon; contact josh@mindsmith.ai)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXCLUDE = /seal|logo|medallion|wordmark|coat|crest|signature|portrait|\bmap\b|diagram|icon|chart|graph|locator|seminary|territorial|1[89]\d\d|academy/i;
const HISTORIC = /\b(18\d\d|19\d\d)\b/; // drop black-and-white archival shots
const PREFER = /campus|aerial|panorama|quad|skyline|stadium|fountain|view|library|union|union/i;

async function getJSON(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function download(url, dest) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

function filePath(name, width) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

function pickCampus(items) {
  const imgs = items.filter((i) => i.type === "image" && i.title && !/\.svg$/i.test(i.title));
  const clean = imgs.filter((i) => !EXCLUDE.test(i.title));
  const modern = clean.filter((i) => !HISTORIC.test(i.title));
  const hit = modern.find((i) => PREFER.test(i.title)) || modern[0] || clean[0] || imgs[0];
  return hit ? hit.title.replace(/^File:/, "") : null;
}

const report = [];
for (const s of SCHOOLS) {
  const t = encodeURIComponent(s.title.replace(/ /g, "_"));
  try {
    // logo from the page summary lead image (seal/wordmark)
    let logoMsg = "—";
    try {
      const sum = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
      const logo = sum.thumbnail?.source; // already a rendered raster thumb
      if (logo) {
        await download(logo, new URL(`${s.id}-logo.png`, OUT));
        logoMsg = "logo ✓";
      }
    } catch (e) { logoMsg = `logo ✗ ${e.message}`; }

    // campus photo from the media list (hand-picked override wins)
    let campusName = s.campus;
    if (!campusName) {
      const ml = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/media-list/${t}`);
      campusName = pickCampus(ml.items || []);
    }
    let campusMsg = "campus ✗ none";
    if (campusName) {
      const bytes = await download(filePath(campusName, 1000), new URL(`${s.id}-campus.jpg`, OUT));
      campusMsg = `campus ✓ ${campusName} (${Math.round(bytes / 1024)}kb)`;
    }
    report.push(`${s.id.padEnd(13)} ${logoMsg.padEnd(8)} ${campusMsg}`);
    await sleep(300);
  } catch (e) {
    report.push(`${s.id.padEnd(13)} ERROR ${e.message}`);
  }
}
console.log(report.join("\n"));
