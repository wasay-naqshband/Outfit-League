// Cheaper lookalikes, step 2: Google Shopping results (via Serper) for the
// garment query, cleaned and sorted cheapest first. US only for now.
export type Lookalike = {
  title: string;
  store: string;
  price: number; // USD
  url: string;
  image: string;
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

export async function searchLookalikes(
  key: string,
  query: string,
  request: typeof fetch = fetch,
): Promise<Lookalike[]> {
  const response = await request("https://google.serper.dev/shopping", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 30 }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "LOOKALIKES_FAILED",
    );
  const data = await response.json();
  const seen = new Set<string>();
  return (
    ((data?.shopping ?? []) as Record<string, unknown>[])
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
      )
      .sort((a, b) => a.price - b.price)
      // Cheapest result per store keeps the list varied.
      .filter((item) => !seen.has(item.store) && !!seen.add(item.store))
      .slice(0, 6)
  );
}
