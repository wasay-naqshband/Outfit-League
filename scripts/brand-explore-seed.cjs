// Prints SQL that fills Explore with products from public Shopify stores.
// Usage: node scripts/brand-explore-seed.cjs --us > seed.sql
// Or pass "Brand=store.com=Style" arguments for a smaller catalog.
// The third part is the brand's default style when no keyword decides it.
const US_STORES = [
  "Kith=kith.com=Streetwear",
  "Princess Polly=us.princesspolly.com=Y2K",
  "Taylor Stitch=taylorstitch.com=Vintage",
  "Alo Yoga=aloyoga.com=Athleisure",
  "Fashion Nova=fashionnova.com=Y2K",
  "Aimé Leon Dore=aimeleondore.com=Streetwear",
  "Edikted=edikted.com=Y2K",
  "Reigning Champ=reigningchamp.com=Minimal",
  "Good American=goodamerican.com=Casual",
  "Culture Kings=culturekings.com=Streetwear",
  "RIPNDIP=ripndip.com=Streetwear",
  "Stüssy=stussy.com=Streetwear",
  "Represent=representclo.com=Streetwear",
  "Allbirds=allbirds.com=Athleisure",
  "tentree=tentree.com=Casual",
  "Aviator=aviatorusa.com=Casual",
  "mnml=mnml.la=Streetwear",
  "Fear of God=fearofgod.com=Minimal",
  "John Elliott=johnelliott.com=Minimal",
  "Noah=noahny.com=Streetwear",
  "Bather=bather.com=Casual",
  "Roark=roark.com=Casual",
  "Outerknown=outerknown.com=Casual",
  "Cuts=cutsclothing.com=Minimal",
  "True Classic=trueclassictees.com=Casual",
  "Jungmaven=jungmaven.com=Minimal",
  "American Giant=american-giant.com=Casual",
  "Madhappy=madhappy.com=Streetwear",
  "Todd Snyder=toddsnyder.com=Formal",
  "NAKEDCASHMERE=nakedcashmere.com=Minimal",
  "Rails=rails.com=Casual",
  "Frank & Eileen=frankandeileen.com=Minimal",
  "Steve Madden=stevemadden.com=Casual",
  "Dolls Kill=dollskill.com=Y2K",
];
const us = process.argv.includes("--us");
const PER_BRAND = us ? 120 : 40;
const brands = us ? US_STORES : process.argv.slice(2);
const kinds = [
  [/jean|denim pant/i, "Denim"],
  [/\bskirt/i, "Skirts"],
  [/\bshorts\b/i, "Shorts"],
  [/sweater|cardigan|knitwear|turtleneck/i, "Knitwear"],
  [/swim|bikini|boardshort|bathing/i, "Swimwear"],
  [/jacket|coat|bomber|puffer|gilet|blazer|parka|windbreaker/i, "Jackets"],
  [/hood|sweatshirt|crewneck|zip[- ]up/i, "Hoodies"],
  [/\bdress(es)?\b(?! shirt)|jumpsuit|romper|playsuit/i, "Dresses"],
  [
    /\btees?\b|t-shirt|\btop\b|tank|sweater|cardigan|\bcami\b|bodysuit|corset/i,
    "Tops",
  ],
  [/shirt|polo|woven|blouse|oxford|kurta|kameez/i, "Shirts"],
  [
    /jean|\bpants?\b|trouser|\bshorts\b|skirt|cargo|jogger|legging|chino/i,
    "Bottoms",
  ],
  [/sneaker|shoe|boot|loafer|slide|sandal|trainer/i, "Shoes"],
  [
    /\bcap\b|\bhat\b|beanie|\bbag\b|tote|backpack|scarf|\bbelt\b|sunglass/i,
    "Accessories",
  ],
];
// First match wins; otherwise the brand's default style.
const styles = [
  [
    /kurta|kurti|shalwar|kameez|lawn|unstitched|dupatta|waistcoat|khaddar|shawl/i,
    "Eastern",
  ],
  [
    /legging|track|gym|active|training|yoga|running|performance|seamless/i,
    "Athleisure",
  ],
  [
    /blazer|suit|formal|oxford|dress shirt|loafer|tailored|pleated trouser/i,
    "Formal",
  ],
  [
    /vintage|washed|retro|varsity|corduroy|distressed|faded|heritage/i,
    "Vintage",
  ],
  [
    /graphic|baby tee|mini|corset|low rise|butterfly|rhinestone|metallic|y2k|halter/i,
    "Y2K",
  ],
  [/basic|essential|plain|linen|cashmere|merino|relaxed|minimal/i, "Minimal"],
];
const skip =
  /boys|girls|kid|baby|infant|junior|underwear|brief|boxer|bra\b|sock|fragrance|perfume|gift|candle|\bcard\b|sample|bundle|mask|jewel|\bring\b|necklace|earring|watch|phone|sticker|poster|mug/i;
const palettes = ["lavender", "coral", "sun", "mint", "pink"];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function brandRows(brand, domain, fallback, brandIndex) {
  // Shopify can localize prices by IP independently of the store's base currency.
  const headers = us
    ? {
        Cookie: "localization=US; cart_currency=USD",
        "Accept-Language": "en-US",
      }
    : {};
  const meta = await fetch(`https://${domain}/meta.json`, {
    signal: AbortSignal.timeout(15000),
  })
    .then((r) => r.json())
    .catch(() => ({}));
  const market = us
    ? await fetch(`https://${domain}/cart.js?currency=USD`, {
        headers,
        signal: AbortSignal.timeout(15000),
      }).then((response) => response.json())
    : meta;
  const currency = market.currency;
  if (!currency || (us && currency !== "USD"))
    throw new Error(domain + ": unverified USD catalog");
  const rows = [],
    names = new Set(),
    perKind = {};
  for (let page = 1; page <= 8 && rows.length < PER_BRAND; page++) {
    const res = await fetch(
      `https://${domain}/products.json?limit=250&page=${page}${us ? "&currency=USD" : ""}`,
      { headers, signal: AbortSignal.timeout(20000) },
    );
    if (!res.ok) throw new Error(`${domain}: HTTP ${res.status}`);
    const { products } = await res.json();
    if (!products.length) break;
    for (const p of products) {
      if (rows.length >= PER_BRAND) break;
      const text = `${p.product_type} ${p.title}`;
      const tags = Array.isArray(p.tags)
        ? p.tags
        : String(p.tags ?? "").split(",");
      if (us && /kids?|toddler|infant|baby|boys|girls/i.test(tags.join(" ")))
        continue;
      if (skip.test(text)) continue;
      const kind = kinds.find(([re]) => re.test(text))?.[1];
      const image = p.images?.[0]?.src?.split("?")[0];
      const variant = p.variants?.find(
        (v) => v.available && Number(v.price) > 0,
      );
      const price = Number(variant?.price);
      if (!kind || !image?.startsWith("https://cdn.shopify.com/") || !price)
        continue;
      // Mix categories: at most a third of a brand's picks from one kind.
      if ((perKind[kind] ?? 0) >= PER_BRAND / 3) continue;
      const style = styles.find(([re]) => re.test(text))?.[1] ?? fallback;
      const name = p.title.trim().slice(0, 100);
      const id = `${brand}-${p.handle}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .slice(0, 64)
        .replace(/-+$/, "");
      // One colourway per product; long handles can cut to the same id.
      if (names.has(name) || names.has(id)) continue;
      names.add(name).add(id);
      perKind[kind] = (perKind[kind] ?? 0) + 1;
      rows.push(
        `(${[
          q(id),
          q(name),
          q(style),
          q(kind),
          q(`${name} by ${brand}. Product photo from the ${brand} store.`),
          q(brand),
          q(
            `${brand} ${p.product_type} ${kind} ${style} ${(p.tags || []).slice?.(0, 6).join(" ") ?? ""}`
              .toLowerCase()
              .slice(0, 300),
          ),
          q("navy"),
          q(palettes[rows.length % palettes.length]),
          q(`${brand} store photo`),
          q(`https://${domain}/products/${p.handle}`),
          q(image),
          q(
            `${currency} ${price.toLocaleString("en-US", {
              maximumFractionDigits: currency === "PKR" ? 0 : 2,
              minimumFractionDigits: currency === "PKR" ? 0 : 2,
            })}`,
          ),
          "true",
          // Interleave retailers so each screen has a different mix.
          1000 + rows.length * Math.max(50, brands.length) + brandIndex,
        ].join(",")})`,
      );
    }
  }
  return { rows, currency };
}

(async () => {
  const rows = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < brands.length) {
        const index = next++;
        const [brand, domain, fallback = "Casual"] = brands[index].split("=");
        try {
          const result = await brandRows(brand, domain, fallback, index);
          rows.push(...result.rows);
          console.error(
            `${brand}: ${result.rows.length} items (${result.currency})`,
          );
        } catch (error) {
          console.error(`${brand}: ${error.message}`);
          if (!us) throw error;
        }
      }
    }),
  );
  if (rows.length < (us ? 1000 : 1))
    throw new Error("Insufficient catalog coverage");
  console.error(`Total: ${rows.length} products`);
  console.log(
    "-- Public US-market product catalog, captured " +
      new Date().toISOString().slice(0, 10) +
      ".\n" +
      "do $$ declare offset_rank integer; begin select coalesce(max(rank),0)+10000 into offset_rank from public.explore_outfits; update public.explore_outfits set rank=rank+offset_rank; end $$;\n" +
      (us
        ? "update public.explore_outfits set published=false where photo_url is not null;\n"
        : "") +
      "insert into public.explore_outfits(id,name,style,category,description,brand,tags,image,palette,source_label,source_url,photo_url,price_label,published,rank) values\n" +
      rows.join(",\n") +
      "\non conflict(id) do update set name=excluded.name,style=excluded.style,category=excluded.category,description=excluded.description,source_label=excluded.source_label,tags=excluded.tags,photo_url=excluded.photo_url,price_label=excluded.price_label,source_url=excluded.source_url,rank=excluded.rank,published=true;",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
