import { NextResponse } from "next/server";

const UA = { "User-Agent": "HaldaDemo/1.0 (hackathon; school media lookup)" };
const EXCLUDE = /seal|logo|medallion|wordmark|coat|crest|signature|portrait|\bmap\b|diagram|icon|chart|graph|locator|seminary|territorial|1[89]\d\d|academy/i;
const HISTORIC = /\b(18\d\d|19\d\d)\b/;
const PREFER = /campus|aerial|panorama|quad|skyline|stadium|fountain|view|library|student.union|commons|hall/i;

async function getJSON(url: string) {
  const r = await fetch(url, { headers: UA, next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function articleTitle(school: string): Promise<string> {
  const q = encodeURIComponent(school);
  const r = await getJSON(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=1&namespace=0&format=json&origin=*`);
  return r?.[1]?.[0] || school;
}

function filePath(name: string, width: number) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

function pickCampus(items: { type?: string; title?: string }[]) {
  const imgs = items.filter((i) => i.type === "image" && i.title && !/\.svg$/i.test(i.title));
  const clean = imgs.filter((i) => !EXCLUDE.test(i.title!));
  const modern = clean.filter((i) => !HISTORIC.test(i.title!));
  const hit = modern.find((i) => PREFER.test(i.title!)) || modern[0] || clean[0] || imgs[0];
  return hit?.title?.replace(/^File:/, "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const school = url.searchParams.get("school")?.trim();
  const kind = url.searchParams.get("kind") === "logo" ? "logo" : "campus";
  if (!school) return NextResponse.json({ error: "school is required" }, { status: 400 });

  try {
    const title = await articleTitle(school);
    const page = encodeURIComponent(title.replace(/ /g, "_"));
    if (kind === "logo") {
      const summary = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`);
      const img = summary.thumbnail?.source || summary.originalimage?.source;
      if (img) return NextResponse.redirect(img, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });
    }

    const media = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/media-list/${page}`);
    const campus = pickCampus(media.items || []);
    if (campus) return NextResponse.redirect(filePath(campus, kind === "logo" ? 256 : 1000), { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });

    const summary = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`);
    const fallback = summary.originalimage?.source || summary.thumbnail?.source;
    if (fallback) return NextResponse.redirect(fallback, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });
  } catch {
    return NextResponse.json({ error: "image not found" }, { status: 404 });
  }

  return NextResponse.json({ error: "image not found" }, { status: 404 });
}
