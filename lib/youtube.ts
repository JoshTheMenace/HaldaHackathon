export interface VirtualTourVideo {
  title: string;
  url: string;
  thumbnailUrl?: string;
  channel?: string;
  source: "youtube";
  isSearchFallback?: boolean;
}

const YT_KEY = process.env.YOUTUBE_API_KEY;
const tourQuery = (school: string) => `${school} campus virtual tour`;
const searchUrl = (school: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(tourQuery(school))}`;
const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const decode = (s: string) => s.replace(/\\u0026|&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\\"/g, "\"");

export async function findVirtualTourVideo(school: string): Promise<VirtualTourVideo> {
  const q = clean(school);
  if (!q) throw new Error("school is required");
  const api = await youtubeApi(q);
  if (api) return api;
  const scraped = await youtubeSearch(q);
  if (scraped) return scraped;
  return {
    title: `${q} virtual tour search`,
    url: searchUrl(q),
    channel: "YouTube",
    source: "youtube",
    isSearchFallback: true,
  };
}

async function youtubeApi(school: string): Promise<VirtualTourVideo | null> {
  if (!YT_KEY) return null;
  try {
    const params = new URLSearchParams({
      key: YT_KEY,
      part: "snippet",
      type: "video",
      maxResults: "1",
      q: tourQuery(school),
      videoEmbeddable: "true",
      safeSearch: "strict",
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const item = (await res.json())?.items?.[0];
    const id = item?.id?.videoId;
    if (!id) return null;
    return {
      title: item.snippet?.title || `${school} virtual tour`,
      url: videoUrl(id),
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || thumb(id),
      channel: item.snippet?.channelTitle,
      source: "youtube",
    };
  } catch {
    return null;
  }
}

async function youtubeSearch(school: string): Promise<VirtualTourVideo | null> {
  try {
    const res = await fetch(searchUrl(school), {
      headers: { "user-agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"videoId":"([^"]{11})"[\s\S]{0,900}?"title":\{"runs":\[\{"text":"([^"]+)"/);
    const id = match?.[1];
    if (!id) return null;
    return {
      title: decode(match?.[2] || `${school} virtual tour`),
      url: videoUrl(id),
      thumbnailUrl: thumb(id),
      channel: "YouTube",
      source: "youtube",
    };
  } catch {
    return null;
  }
}
