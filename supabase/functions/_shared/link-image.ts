// "Try on from a store link": find the product photo on a shop page.
// The URL comes from the user, so every hop is checked: public http(s) host
// names only, no IP literals, no custom ports, few redirects, bounded bodies.
// DNS checks block private destinations, but cannot prevent DNS rebinding.
const MAX_PAGE = 3 * 1024 * 1024;
const MAX_PHOTO = 6 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
// Stores serve their product meta tags to ordinary mobile browsers.
const AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export type ResolveDns = (
  hostname: string,
  recordType: "A" | "AAAA",
) => Promise<string[]>;

const resolveDns: ResolveDns = (hostname, recordType) =>
  Deno.resolveDns(hostname, recordType);

function publicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b, c] = octets as [number, number, number, number];
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function publicIpv6(address: string) {
  if (address.includes("%") || address.includes(".")) return false;
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0]!.split(":") : [];
  const right = halves[1] ? halves[1]!.split(":") : [];
  const groups = [...left, ...right];
  if (
    groups.some((group) => !/^[\da-f]{1,4}$/.test(group)) ||
    (halves.length === 1 ? groups.length !== 8 : groups.length >= 8)
  )
    return false;
  const padded = [...left, ...Array(8 - groups.length).fill("0"), ...right].map(
    (group) => parseInt(group, 16),
  );
  // Public IPv6 unicast is 2000::/3. Exclude IETF special-use, documentation,
  // and 6to4 ranges even though they fall within that broad allocation.
  const first = padded[0]!;
  return (
    first >= 0x2000 &&
    first <= 0x3fff &&
    !(
      (first === 0x2001 && padded[1]! <= 0x01ff) ||
      (first === 0x2001 && padded[1] === 0x0db8) ||
      first === 0x2002
    )
  );
}

async function assertPublicHost(url: URL, resolve: ResolveDns) {
  let found = false;
  for (const type of ["A", "AAAA"] as const) {
    let addresses: string[];
    try {
      addresses = await resolve(url.hostname, type);
    } catch (error) {
      if ((error as { name?: string }).name === "NotFound") continue;
      throw new Error("LINK_FAILED");
    }
    found ||= addresses.length > 0;
    const isPublic = type === "A" ? publicIpv4 : publicIpv6;
    if (addresses.some((address) => !isPublic(address)))
      throw new Error("LINK_FAILED");
  }
  if (!found) throw new Error("LINK_FAILED");
}

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

async function get(
  start: URL,
  max: number,
  request: typeof fetch,
  resolve: ResolveDns,
) {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url, resolve);
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

// Fetch server-selected image URLs with the same host, DNS, redirect and body
// limits as user-pasted links. Third-party search results are untrusted too.
export async function fetchPublicAsset(
  value: unknown,
  max: number,
  request: typeof fetch = fetch,
  resolve: ResolveDns = resolveDns,
): Promise<{ type: string; data: Uint8Array }> {
  const url = publicUrl(value);
  if (url.protocol !== "https:" || !Number.isSafeInteger(max) || max < 1)
    throw new Error("LINK_FAILED");
  const result = await get(url, max, request, resolve);
  return { type: result.type, data: result.bytes };
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
  resolve: ResolveDns = resolveDns,
): Promise<{ type: string; data: Uint8Array }> {
  const page = await get(publicUrl(link), MAX_PAGE, request, resolve);
  if (PHOTO_TYPES.includes(page.type)) {
    if (page.bytes.length > MAX_PHOTO) throw new Error("LINK_FAILED");
    return { type: page.type, data: page.bytes };
  }
  if (!page.type.includes("html")) throw new Error("LINK_NO_IMAGE");
  const found = findProductImage(new TextDecoder().decode(page.bytes));
  if (!found) throw new Error("LINK_NO_IMAGE");
  const photo = await get(
    publicUrl(found, page.url.href),
    MAX_PHOTO,
    request,
    resolve,
  );
  if (!PHOTO_TYPES.includes(photo.type)) throw new Error("LINK_NO_IMAGE");
  return { type: photo.type, data: photo.bytes };
}
