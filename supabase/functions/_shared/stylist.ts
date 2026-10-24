// AI stylist: short structured advice from Gemini (JSON mode). Photos are
// validated JPEG data URIs read from private storage.
const MODEL = "gemini-3.5-flash";
const VOICE =
  "You are a warm, honest personal stylist. Judge only clothes, colours, fit and how pieces work together. " +
  "Never comment on body weight, body shape as a flaw, face, skin as a flaw, age or attractiveness. Keep every line short and specific.";

type Part =
  { text: string } | { inline_data: { mime_type: string; data: string } };
const photo = (uri: string): Part => ({
  inline_data: { mime_type: "image/jpeg", data: uri.slice(23) },
});
const str = { type: "STRING" };
const list = { type: "ARRAY", items: str };
const swatches = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { name: str, hex: str },
    required: ["name", "hex"],
  },
};

async function ask(
  key: string,
  parts: Part[],
  schema: Record<string, unknown>,
  request: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await request(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: VOICE }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "PROVIDER_BUSY" : "STYLIST_FAILED",
    );
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");
  try {
    const value = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value))
      return value;
  } catch {
    /* falls through */
  }
  throw new Error("STYLIST_FAILED");
}

// Model output is untrusted: keep only bounded strings of the expected shape.
const line = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const lines = (value: unknown, count = 4) =>
  (Array.isArray(value) ? value : [])
    .map((item) => line(item))
    .filter(Boolean)
    .slice(0, count);
const colors = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({ name: line(item?.name, 40), hex: line(item?.hex, 7) }))
    .filter((item) => item.name && /^#[0-9a-f]{6}$/i.test(item.hex))
    .slice(0, 8);

export async function rateFit(
  key: string,
  look: string,
  request: typeof fetch = fetch,
) {
  const out = await ask(
    key,
    [
      photo(look),
      {
        text: "Rate this outfit from 1 to 10 like a stylist would. Give a one-line verdict, up to 3 things that work, and up to 3 specific, doable tips to improve it (e.g. tuck the shirt, roll the sleeves, swap to darker trousers).",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        score: { type: "INTEGER" },
        headline: str,
        good: list,
        tips: list,
      },
      required: ["score", "headline", "good", "tips"],
    },
    request,
  );
  const score = Math.round(Number(out.score));
  return {
    score: Number.isFinite(score) ? Math.min(10, Math.max(1, score)) : 7,
    headline: line(out.headline, 120),
    good: lines(out.good, 3),
    tips: lines(out.tips, 3),
  };
}

export async function colorAnalysis(
  key: string,
  person: string,
  request: typeof fetch = fetch,
) {
  const out = await ask(
    key,
    [
      photo(person),
      {
        text: "Do a seasonal colour analysis from this photo (skin undertone, hair and eye contrast). Name the season (e.g. Soft Autumn), explain it in one or two friendly sentences, and give the best clothing colours, good neutrals and colours to avoid near the face, each with a hex code. Add up to 3 short tips. If lighting makes it uncertain, say so in the summary.",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        season: str,
        summary: str,
        best: swatches,
        neutrals: swatches,
        avoid: swatches,
        tips: list,
      },
      required: ["season", "summary", "best", "neutrals", "avoid", "tips"],
    },
    request,
  );
  return {
    season: line(out.season, 40),
    summary: line(out.summary, 300),
    best: colors(out.best),
    neutrals: colors(out.neutrals),
    avoid: colors(out.avoid),
    tips: lines(out.tips, 3),
  };
}

export type ClosetItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  brand: string;
  tags: string;
};
export async function pickOutfit(
  key: string,
  occasion: string,
  closet: ClosetItem[],
  season: string | null,
  request: typeof fetch = fetch,
) {
  const listing = closet
    .map(
      (item) =>
        `${item.id} | ${item.name} | ${item.category} | ${item.color || "-"} | ${item.brand || "-"} | ${item.tags || "-"}`,
    )
    .join("\n");
  const out = await ask(
    key,
    [
      {
        text:
          `Occasion: ${occasion}\n` +
          (season ? `Their colour season: ${season}\n` : "") +
          (closet.length
            ? `Their closet (id | name | category | colour | brand | tags):\n${listing}\n\nBuild one complete outfit from their closet only, using item ids exactly as listed. If something important is missing, say what to add.`
            : "Their closet is empty. Describe one complete outfit to wear and leave itemIds empty.") +
          " Give a catchy title, one or two sentences on why it works for the occasion, and up to 3 styling tips.",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        title: str,
        why: str,
        itemIds: list,
        missing: list,
        tips: list,
      },
      required: ["title", "why", "itemIds", "missing", "tips"],
    },
    request,
  );
  const ids = new Set(closet.map((item) => item.id));
  return {
    title: line(out.title, 80),
    why: line(out.why, 300),
    items: [...new Set(lines(out.itemIds, 6))].filter((id) => ids.has(id)),
    missing: lines(out.missing, 3),
    tips: lines(out.tips, 3),
  };
}

// Cheaper lookalikes, step 1: a short shopping query for the garment photo.
export async function garmentQuery(
  key: string,
  garment: string,
  request: typeof fetch = fetch,
) {
  const out = await ask(
    key,
    [
      photo(garment),
      {
        text: "This photo shows a clothing item, possibly worn by someone. Describe only the main garment as a short online shopping search query (4 to 8 words: gender if obvious, colour, material or knit, style, type), e.g. 'men's grey cream colour block zip knit cardigan'. No brand names unless clearly printed.",
      },
    ],
    { type: "OBJECT", properties: { query: str }, required: ["query"] },
    request,
  );
  const query = line(out.query, 100);
  if (!query) throw new Error("STYLIST_FAILED");
  return query;
}
