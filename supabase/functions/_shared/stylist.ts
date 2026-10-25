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
export const PIECE_PARTS = [
  "top",
  "layer",
  "bottoms",
  "shoes",
  "accessory",
] as const;
// Outfit pieces from the model or the app: known parts, bounded strings, and a
// closet id only when `owned` accepts it.
export function cleanPieces(value: unknown, owned: (id: string) => boolean) {
  return (Array.isArray(value) ? value : [])
    .map((p: Record<string, unknown>) => ({
      part: PIECE_PARTS.includes(p?.part as (typeof PIECE_PARTS)[number])
        ? (p.part as (typeof PIECE_PARTS)[number])
        : "accessory",
      name: line(p?.name, 90),
      query: line(p?.query, 90),
      closetId: owned(String(p?.closetId)) ? String(p.closetId) : null,
    }))
    .filter((p) => p.name && p.query)
    .slice(0, 6);
}
// What a styled try-on keeps for its result screen (sent by the app).
export function cleanStyled(value: unknown) {
  const v = (value ?? {}) as Record<string, unknown>;
  const pieces = cleanPieces(v.pieces, (id) => /^[0-9a-f-]{36}$/i.test(id));
  return pieces.length
    ? { title: line(v.title, 80), request: line(v.request, 200), pieces }
    : null;
}

// AI Stylist: a complete outfit for the occasion, each piece with a shopping
// query (for Shop the look). With a closet, pieces they own carry its id.
export async function styleOutfit(
  key: string,
  occasion: string,
  styles: string[],
  closet: ClosetItem[] | null,
  request: typeof fetch = fetch,
) {
  const listing = (closet ?? [])
    .map(
      (item) =>
        `${item.id} | ${item.name} | ${item.category} | ${item.color || "-"} | ${item.brand || "-"}`,
    )
    .join("\n");
  const out = await ask(
    key,
    [
      {
        text:
          `Request: ${occasion}\n` +
          (styles.length ? `Their style: ${styles.join(", ")}\n` : "") +
          (closet
            ? `Their closet (id | name | category | colour | brand):\n${listing}\nUse pieces from their closet wherever they fit, giving that piece's closetId exactly as listed; only add new pieces for gaps.\n`
            : "") +
          "Style one complete, great-looking outfit for this request: 3 to 6 pieces (top, optional layer, bottoms, shoes, and accessories only if they add something). " +
          "Describe each piece concretely, colour, fabric and fit, e.g. 'black matte cropped puffer jacket'. " +
          "For each piece give a short US online shopping query (4 to 8 words, gender if obvious, no brand names). " +
          "Add a catchy title, one or two sentences on why it works, and up to 3 short styling tips.",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        title: str,
        why: str,
        pieces: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              part: { type: "STRING", enum: [...PIECE_PARTS] },
              name: str,
              query: str,
              closetId: str,
            },
            required: ["part", "name", "query"],
          },
        },
        tips: list,
      },
      required: ["title", "why", "pieces", "tips"],
    },
    request,
  );
  const owned = new Set((closet ?? []).map((item) => item.id));
  const pieces = cleanPieces(out.pieces, (id) => owned.has(id));
  if (!pieces.length) throw new Error("STYLIST_FAILED");
  return {
    title: line(out.title, 80),
    why: line(out.why, 300),
    pieces,
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
        text: "This photo shows a clothing item, possibly worn by someone. Describe only the main garment as an online shopping search query of 5 to 10 words. Lead with what makes it distinctive (colour blocks, stripes, lettering or graphics, unusual collar or texture), then gender if obvious, colours and type, e.g. 'men's grey cream colour block letter zip knit cardigan'. No brand names unless clearly printed.",
      },
    ],
    { type: "OBJECT", properties: { query: str }, required: ["query"] },
    request,
  );
  const query = line(out.query, 100);
  if (!query) throw new Error("STYLIST_FAILED");
  return query;
}

// Cheaper lookalikes, step 3: score each candidate photo against the garment.
export async function scoreLookalikes(
  key: string,
  garment: string,
  candidates: { mime: string; data: string }[],
  request: typeof fetch = fetch,
): Promise<number[]> {
  const out = await ask(
    key,
    [
      photo(garment),
      ...candidates.flatMap((c, i): Part[] => [
        { text: `Candidate ${i}:` },
        { inline_data: { mime_type: c.mime, data: c.data } },
      ]),
      {
        text:
          "The first image is the original garment (possibly worn by someone; judge only the main garment). " +
          "Score how closely each candidate's garment matches it, 0 to 10: same type and silhouette, colours and colour placement, pattern or graphics (lettering, stripes, blocks), knit or fabric texture, collar and fastening. " +
          "10 = near identical, 7 = clearly the same style with small differences, 4 = same category but a different look, 0 = unrelated. Return one score per candidate index.",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        scores: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              index: { type: "INTEGER" },
              score: { type: "INTEGER" },
            },
            required: ["index", "score"],
          },
        },
      },
      required: ["scores"],
    },
    request,
  );
  const scores = candidates.map(() => 0);
  for (const s of (Array.isArray(out.scores) ? out.scores : []) as {
    index?: unknown;
    score?: unknown;
  }[]) {
    const i = Number(s.index),
      v = Number(s.score);
    if (
      Number.isInteger(i) &&
      i >= 0 &&
      i < scores.length &&
      Number.isFinite(v)
    )
      scores[i] = Math.max(0, Math.min(10, Math.round(v)));
  }
  return scores;
}

// Before a try-on spends a credit: one person, face visible, framed to show
// clothes, clear enough to see them. Lenient on purpose: knee-up and mirror
// photos with a visible face pass.
export type PhotoProblem =
  | "PHOTO_NO_PERSON"
  | "PHOTO_GROUP"
  | "PHOTO_SELFIE"
  | "PHOTO_CLOSE_UP"
  | "PHOTO_UNCLEAR";
export async function checkPhoto(
  key: string,
  person: string,
  request: typeof fetch = fetch,
): Promise<PhotoProblem | null> {
  const out = await ask(
    key,
    [
      photo(person),
      {
        text:
          "This photo will be used for a virtual clothing try-on. Report: how many people are clearly visible; " +
          "whether a phone, hand or object hides most of the face; the framing (full_body = head to feet, " +
          "knees_up, waist_up, head_only = face or head and shoulders); whether it is an arm's-length front-camera selfie; " +
          "and whether the clothes can be made out (clear = false only if it is so blurry or dark that you cannot tell what they are wearing; night or moody photos with visible clothes are clear).",
      },
    ],
    {
      type: "OBJECT",
      properties: {
        people: { type: "INTEGER" },
        faceHidden: { type: "BOOLEAN" },
        framing: {
          type: "STRING",
          enum: ["full_body", "knees_up", "waist_up", "head_only"],
        },
        armSelfie: { type: "BOOLEAN" },
        clear: { type: "BOOLEAN" },
      },
      required: ["people", "faceHidden", "framing", "armSelfie", "clear"],
    },
    request,
  );
  const people = Number(out.people);
  if (people === 0) return "PHOTO_NO_PERSON";
  if (people > 1) return "PHOTO_GROUP";
  if (out.faceHidden === true) return "PHOTO_SELFIE";
  if (out.framing === "head_only") return "PHOTO_CLOSE_UP";
  if (out.armSelfie === true && out.framing !== "full_body")
    return "PHOTO_SELFIE";
  if (out.clear === false) return "PHOTO_UNCLEAR";
  return null;
}
