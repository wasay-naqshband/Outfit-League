// Prints SQL that fills Explore with products from public Shopify stores.
// Usage: node scripts/brand-explore-seed.cjs "Outfitters=outfitters.com.pk=Casual" ... > seed.sql
// The third part is the brand's default style when no keyword decides it.
// Beta only: get each brand's permission before a public release.
const PER_BRAND = 40;
const kinds = [
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
    /legging|sports bra|track|gym|active|training|yoga|running|performance|seamless/i,
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
  // The store's own currency (products.json prices are in it).
  const meta = await fetch(`https://${domain}/meta.json`)
    .then((r) => r.json())
    .catch(() => ({}));
  const currency = meta.currency || "USD";
  const rows = [],
    names = new Set(),
    perKind = {};
  for (let page = 1; page <= 4 && rows.length < PER_BRAND; page++) {
    const res = await fetch(
      `https://${domain}/products.json?limit=250&page=${page}`,
    );
    if (!res.ok) throw new Error(`${domain}: HTTP ${res.status}`);
    const { products } = await res.json();
    if (!products.length) break;
    for (const p of products) {
      if (rows.length >= PER_BRAND) break;
      const text = `${p.product_type} ${p.title}`;
      if (skip.test(text)) continue;
      const kind = kinds.find(([re]) => re.test(text))?.[1];
      const image = p.images?.[0]?.src?.split("?")[0];
      const price = Number(p.variants?.[0]?.price);
      if (!kind || !image?.startsWith("https://cdn.shopify.com/") || !price)
        continue;
      // Mix categories: at most a third of a brand's picks from one kind.
      if ((perKind[kind] ?? 0) >= PER_BRAND / 3) continue;
      const style = styles.find(([re]) => re.test(text))?.[1] ?? fallback;
      const name = p.title
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 100);
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
          q(`${brand} store photo · beta preview, not affiliated`),
          q(`https://${domain}/products/${p.handle}`),
          q(image),
          q(
            `${currency} ${price.toLocaleString("en-US", {
              maximumFractionDigits: currency === "PKR" ? 0 : 2,
              minimumFractionDigits: currency === "PKR" ? 0 : 2,
            })}`,
          ),
          "true",
          // Brands alternate in Trending: item i of brand b sits at 1000 + 50i + b.
          1000 + rows.length * 50 + brandIndex,
        ].join(",")})`,
      );
    }
  }
  return { rows, currency };
}

(async () => {
  const rows = [];
  const brands = process.argv.slice(2);
  for (const [i, arg] of brands.entries()) {
    const [brand, domain, fallback = "Casual"] = arg.split("=");
    const result = await brandRows(brand, domain, fallback, i);
    rows.push(...result.rows);
    console.error(`${brand}: ${result.rows.length} items (${result.currency})`);
  }
  console.log(
    // Older brand rows move behind the new ones so ranks stay unique.
    "update public.explore_outfits set rank=rank+100000 where photo_url is not null;\n" +
      "insert into public.explore_outfits(id,name,style,category,description,brand,tags,image,palette,source_label,source_url,photo_url,price_label,published,rank) values\n" +
      rows.join(",\n") +
      "\non conflict(id) do update set name=excluded.name,style=excluded.style,category=excluded.category,tags=excluded.tags,photo_url=excluded.photo_url,price_label=excluded.price_label,source_url=excluded.source_url,rank=excluded.rank,published=true;",
  );
})();
