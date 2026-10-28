// Cheaper lookalikes: Google Lens finds what looks like the garment, Google
// Shopping (both via Serper) prices it in the US, and an AI score keeps only
// close matches. Closest match first, then cheapest.
import { fetchPublicAsset } from "./link-image.ts";
export type Lookalike = {
  title: string;
  store: string;
  price: number | null; // USD; null when only the store page shows it
  url: string;
  image: string;
  score?: number; // 0–10 look-alike score from the AI
};

const https = (value: unknown) => {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};
// "$1,249.99", "$49.99 now", "49.99" → number; anything else → null.
export const usd = (value: unknown) => {
  const match =
    typeof value === "string"
      ? value.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/)
      : null;
  const price = match ? Number(match[1]!.replace(/,/g, "")) : NaN;
  return Number.isFinite(price) && price > 0 && price < 10000 ? price : null;
};

async function serper(
  key: string,
  kind: "shopping" | "lens" | "search",
  body: Record<string, unknown>,
  request: typeof fetch,
) {
  const response = await request(`https://google.serper.dev/${kind}`, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ gl: "us", hl: "en", ...body }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "LOOKALIKES_FAILED",
    );
  return await response.json();
}

// US shopping results with a real price, secure link and photo.
export async function shopping(
  key: string,
  query: string,
  request: typeof fetch = fetch,
): Promise<Lookalike[]> {
  const data = await serper(key, "shopping", { q: query, num: 20 }, request);
  return ((data?.shopping ?? []) as Record<string, unknown>[])
    .map((item) => ({
      title: String(item.title ?? "")
        .trim()
        .slice(0, 120),
      store: String(item.source ?? "")
        .trim()
        .slice(0, 60),
      price: usd(item.price),
      url: https(item.link),
      image: https(item.imageUrl),
    }))
    .filter(
      (item): item is Lookalike =>
        !!item.title &&
        !!item.store &&
        !!item.price &&
        !!item.url &&
        !!item.image,
    );
}

// Store pages a US shopper can use: no social, wholesale or foreign storefronts.
const NOT_STORES =
  /(^|\.)(instagram|tiktok|pinterest|facebook|youtube|reddit|x|twitter|dhgate|alibaba|mercadolibre|ebay)\./;
export function usStorePage(link: string | null) {
  if (!link) return false;
  const url = new URL(link);
  const host = url.hostname.toLowerCase();
  const sub = host.split(".").length > 2 ? host.split(".")[0]! : "";
  return (
    /\.(com|us)$/.test(host) &&
    ["", "www", "us", "m", "shop", "store"].includes(sub) &&
    !NOT_STORES.test(host) &&
    url.pathname.length > 1 &&
    // Foreign storefront paths like /au/en/ or /is-en/.
    !/^\/(?!us\b)[a-z]{2}([-_][a-z]{2})?(\/|$)/i.test(url.pathname)
  );
}

// Visual matches: products that look like the garment (no prices), plus
// their names as extra shopping queries.
export async function lens(
  key: string,
  imageUrl: string,
  request: typeof fetch = fetch,
): Promise<{ items: Lookalike[]; queries: string[] }> {
  const data = await serper(key, "lens", { url: imageUrl }, request);
  const organic = (data?.organic ?? []) as Record<string, unknown>[];
  const items = organic
    .map((item) => ({
      title: String(item.title ?? "")
        .split(/[|–—]/)[0]!
        .trim()
        .slice(0, 120),
      store: String(item.source ?? "")
        .trim()
        .slice(0, 60),
      price: null as number | null,
      url: https(item.link),
      image: https(item.thumbnailUrl) ?? https(item.imageUrl),
    }))
    .filter(
      (item) =>
        !!item.title && !!item.store && !!item.image && usStorePage(item.url),
    ) as Lookalike[];
  const seen = new Set<string>();
  const queries = items
    .map((item) =>
      item.title
        .replace(/[^\p{L}\p{N}' -]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 10)
        .join(" "),
    )
    .filter((q) => q.length > 8 && !seen.has(q) && !!seen.add(q))
    .slice(0, 2);
  return { items, queries };
}

// Small product photo for the AI score, bounded and image-only.
export async function thumbnail(
  url: string,
  request: typeof fetch = fetch,
): Promise<{ mime: string; data: string } | null> {
  let photo: { type: string; data: Uint8Array };
  try {
    photo = await fetchPublicAsset(url, 1_500_000, request);
  } catch {
    return null;
  }
  const mime = photo.type;
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
  const bytes = photo.data;
  let text = "";
  for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return { mime, data: btoa(text) };
}

// Close matches (7+) first; if fewer than three, top up with similar styles
// (5–6). One per store, closest first, then cheapest (unpriced last).
// Without scores, fall back to cheapest first.
// "Shein", "shein.com" and "SHEIN" are one store.
const storeKey = (store: string) =>
  store
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.(com|us)$/, "")
    .trim();
const cheaper = (a: Lookalike, b: Lookalike) =>
  (a.price ?? Infinity) - (b.price ?? Infinity);
export function rank(items: Lookalike[]): Lookalike[] {
  const scored = items.some((item) => item.score !== undefined);
  const best = new Map<string, Lookalike>();
  for (const item of items
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || cheaper(a, b)))
    if (!best.has(storeKey(item.store))) best.set(storeKey(item.store), item);
  const stores = [...best.values()];
  if (!scored) return stores.sort(cheaper).slice(0, 6);
  const close = stores.filter((item) => item.score! >= 7);
  const similar = stores.filter((item) => item.score! >= 5 && item.score! < 7);
  const [closest, ...rest] = [
    ...close,
    ...(close.length < 3 ? similar.slice(0, 3 - close.length) : []),
  ];
  return closest ? [closest, ...rest.sort(cheaper)].slice(0, 6) : [];
}

// Shop the look, from Google's relevance order (one per store, top 8): the
// closest result, the cheapest of the rest, then the next closest.
export function pieceOptions(items: Lookalike[], count = 3): Lookalike[] {
  const seen = new Set<string>();
  const [best, ...rest] = items
    .filter(
      (item) =>
        !seen.has(storeKey(item.store)) && !!seen.add(storeKey(item.store)),
    )
    .slice(0, 8);
  if (!best) return [];
  const cheapest = rest.slice().sort(cheaper)[0];
  return [
    best,
    ...rest.filter((item) => item === cheapest),
    ...rest.filter((item) => item !== cheapest),
  ].slice(0, count);
}

// "zarausa" (Zara USA) is zara.com; "walmart" is walmart.com.
const sameStore = (domain: string, name: string) =>
  domain === name ||
  (domain.length >= 3 && (name.startsWith(domain) || domain.startsWith(name)));
export const isGoogle = (url: string) =>
  /(^|\.)google\./.test(new URL(url).hostname);
// Shop the look: up to 3 options that open the store's own product page.
// Links are resolved now, in parallel, so tapping Shop opens instantly.
export async function directOptions(
  key: string,
  items: Lookalike[],
  request: typeof fetch = fetch,
): Promise<Lookalike[]> {
  const pool = await Promise.all(
    pieceOptions(items, 6).map((item) =>
      storeLink(key, item, request)
        .then((url) => ({ ...item, url }))
        .catch(() => item),
    ),
  );
  return pieceOptions(pool.filter((item) => !isGoogle(item.url)));
}
// Google Shopping links open Google, not the store. Find the store's own
// product page with one web search (done when "Buy" is tapped, then saved).
export async function storeLink(
  key: string,
  item: Lookalike,
  request: typeof fetch = fetch,
): Promise<string> {
  if (!isGoogle(item.url)) return item.url;
  const data = await serper(
    key,
    "search",
    { q: item.title + " " + item.store, num: 10 },
    request,
  );
  // "Walmart - Zpanxa" → "walmart", "H&M" → "hm", "shein.com" → "shein".
  const name = storeKey(item.store.split(/ - |\(/)[0]!).replace(
    /[^a-z0-9]/g,
    "",
  );
  // The store's own domain (www2.hm.com → "hm"), on a product page, not a
  // category, search or listing page.
  const domain = (link: string) =>
    new URL(link).hostname.toLowerCase().split(".").slice(-2)[0]!;
  const listing =
    /\/(browse|brand|b|search[\w-]*|s|c|category|categories|collections?|shop|catalog|deals)(\/|$|\?|\.)/i;
  const links = ((data?.organic ?? []) as { link?: unknown }[])
    .map((result) => https(result.link))
    .filter((link): link is string => !!link);
  return (
    links.find(
      (link) =>
        name.length > 1 &&
        sameStore(domain(link).replace(/[^a-z0-9]/g, ""), name) &&
        !listing.test(new URL(link).pathname),
    ) ?? item.url
  );
}
