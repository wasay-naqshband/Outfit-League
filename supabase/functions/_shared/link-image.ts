// "Try on from a store link": find the product photo on a shop page.
// The URL comes from the user, so every hop is checked: public http(s) host
// names only, no IP literals, no custom ports, few redirects, bounded bodies.
// ponytail: host-name checks only (no DNS resolution), add a resolver check
// if this ever runs somewhere that can reach a private network.
const MAX_PAGE = 3 * 1024 * 1024;
const MAX_PHOTO = 6 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
// Stores serve their product meta tags to ordinary mobile browsers.
const AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export function publicUrl(value: unknown, base?: string): URL {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("LINK_FAILED");
  let url: URL;
  try {
    url = new URL(value.trim(), base);
  } catch {
    throw new Error("LINK_FAILED");
  }
  const host = url.hostname.toLowerCase();
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !host.includes(".") ||
    host.startsWith("[") ||
    /^[\d.]+$/.test(host) ||
    /(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)
  )
    throw new Error("LINK_FAILED");
  return url;
}

async function get(start: URL, max: number, request: typeof fetch) {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    const response = await request(url.href, {
      redirect: "manual",
      headers: { "User-Agent": AGENT, Accept: "text/html,image/*;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      url = publicUrl(response.headers.get("location"), url.href);
      continue;
    }
    if (!response.ok || !response.body) throw new Error("LINK_FAILED");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) throw new Error("LINK_FAILED");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    return { url, type, bytes };
  }
  throw new Error("LINK_FAILED");
}

const decodeEntities = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");

// The product photo stores advertise for link previews (og:image and friends),
// then the first image in the page's Product JSON-LD.
export function findProductImage(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (
      /(?:property|name)\s*=\s*["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/i.test(
        tag,
      )
    ) {
      const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
      if (content) return decodeEntities(content);
    }
  }
  const link = html.match(
    /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i,
  )?.[1];
  if (link) return decodeEntities(link);
  const ld = html.match(/"image"\s*:\s*\[?\s*"([^"]+)"/)?.[1];
  return ld ? decodeEntities(ld) : null;
}

export async function linkImage(
  link: unknown,
  request: typeof fetch = fetch,
): Promise<{ type: string; data: Uint8Array }> {
  const page = await get(publicUrl(link), MAX_PAGE, request);
  if (PHOTO_TYPES.includes(page.type)) {
    if (page.bytes.length > MAX_PHOTO) throw new Error("LINK_FAILED");
    return { type: page.type, data: page.bytes };
  }
  if (!page.type.includes("html")) throw new Error("LINK_NO_IMAGE");
  const found = findProductImage(new TextDecoder().decode(page.bytes));
  if (!found) throw new Error("LINK_NO_IMAGE");
  const photo = await get(publicUrl(found, page.url.href), MAX_PHOTO, request);
  if (!PHOTO_TYPES.includes(photo.type)) throw new Error("LINK_NO_IMAGE");
  return { type: photo.type, data: photo.bytes };
}
