const SUPABASE_URL = "https://xxrylsmiaehgnljyzguh.supabase.co";
const SUPABASE_KEY = "sb_publishable_HecThul_Ql3yp1tmG3_fVA_JYq94elU";
const APP_URL = "https://chutni.store";
const SOCIAL_CRAWLER =
  /facebookexternalhit|facebot|whatsapp|twitterbot|discordbot|slackbot|telegrambot|linkedinbot|pinterest/i;
const SIDES = ["a", "b", "c", "d"] as const;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

export async function battlePreview(
  request: Request,
  next: () => Promise<Response>,
  fetcher: typeof fetch = fetch,
) {
  const id = new URL(request.url).pathname.split("/").pop() ?? "";
  if (
    !SOCIAL_CRAWLER.test(request.headers.get("user-agent") ?? "") ||
    !/^[0-9a-f-]{36}$/i.test(id)
  )
    return next();

  try {
    const response = await fetcher(`${SUPABASE_URL}/functions/v1/battles`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "share-preview",
        id,
        token: crypto.randomUUID(),
      }),
    });
    if (!response.ok) return next();
    const battle = await response.json();
    if (!battle.title || !Array.isArray(battle.sides) || !battle.sides.length)
      return next();

    const title = escapeHtml(String(battle.title));
    const description = escapeHtml(
      battle.kind === "versus"
        ? "Two looks. One fit battle. Pick your side and tell them why."
        : "Two or more looks. One winner. Cast your vote and settle the fit check.",
    );
    const url = `${APP_URL}/battle/${id}`;
    const images = battle.sides
      .slice(0, 4)
      .map((side: string) => {
        if (!SIDES.includes(side as (typeof SIDES)[number])) return "";
        const image = `${APP_URL}/battle/${id}/image/${side}`;
        return `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:type" content="image/jpeg">`;
      })
      .join("");
    const firstSide = battle.sides.find((side: string) =>
      SIDES.includes(side as (typeof SIDES)[number]),
    );
    if (!firstSide) return next();
    const firstImage = `${APP_URL}/battle/${id}/image/${firstSide}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Outfit League</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="Outfit League"><meta property="og:title" content="⚡ ${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}">${images}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="⚡ ${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${escapeHtml(firstImage)}"><meta http-equiv="refresh" content="0;url=${url}"></head><body><p>Opening your Outfit League battle… <a href="${url}">Vote now</a>.</p></body></html>`;
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return next();
  }
}

export async function battleImage(
  request: Request,
  id: string,
  side: string,
  fetcher: typeof fetch = fetch,
) {
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !SIDES.includes(side as (typeof SIDES)[number])
  )
    return new Response("Not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  try {
    const response = await fetcher(`${SUPABASE_URL}/functions/v1/battles`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`,
        "content-type": "application/json",
        origin: new URL(request.url).origin,
      },
      body: JSON.stringify({
        action: "share-image",
        id,
        side,
        token: crypto.randomUUID(),
      }),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.toLowerCase().startsWith("image/jpeg")
    )
      return new Response("Not found", {
        status: 404,
        headers: { "cache-control": "no-store" },
      });
    return new Response(response.body, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=300, s-maxage=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Temporarily unavailable", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
