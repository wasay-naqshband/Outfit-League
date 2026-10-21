// Prints SQL that adds tops/jackets from public Shopify stores to Explore.
// Usage: node scripts/brand-explore-seed.cjs "Outfitters=outfitters.com.pk" "Breakout=breakout.com.pk" > seed.sql
// Beta only: get each brand's permission before a public release.
const PER_BRAND = 15;
const kinds = [
  [/jacket|coat|bomber|puffer|gilet/i, "Jackets", "Streetwear"],
  [/hood|sweatshirt/i, "Hoodies", "Streetwear"],
  [/\btees?\b|t-shirt|top|knit|sweater|upper/i, "Tops", "Streetwear"],
  [/shirt|polo|woven|blouse|oxford/i, "Shirts", "Minimal"],
];
const palettes = ["lavender", "coral", "sun", "mint", "pink"];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function brandRows(brand, domain, rankStart) {
  const rows = [],
    names = new Set();
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
      if (
        /pant|jean|trouser|short|skirt|dress|shoe|sock|cap|bag|belt|jewel|watch|underwear|boys|girls|kid|baby/i.test(
          text,
        )
      )
        continue;
      const kind = kinds.find(([re]) => re.test(text));
      const image = p.images?.[0]?.src?.split("?")[0];
      const price = Number(p.variants?.[0]?.price);
      if (!kind || !image?.startsWith("https://cdn.shopify.com/") || !price)
        continue;
      const style = /graphic|print/i.test(p.title) ? "Y2K" : kind[2];
      const name = p.title
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 100);
      if (names.has(name)) continue; // one colourway per product
      names.add(name);
      const id = `${brand}-${p.handle}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .slice(0, 64)
        .replace(/-+$/, "");
      rows.push(
        `(${[
          q(id),
          q(name),
          q(style),
          q(kind[1]),
          q(`${name} by ${brand}. Product photo from the ${brand} store.`),
          q(brand),
          q(`${brand} ${p.product_type} ${kind[1]}`.toLowerCase()),
          q("navy"),
          q(palettes[rows.length % palettes.length]),
          q(`${brand} store photo · beta preview, not affiliated`),
          q(`https://${domain}/products/${p.handle}`),
          q(image),
          q(`PKR ${Math.round(price).toLocaleString("en-US")}`),
          "true",
          rankStart + rows.length * 10,
        ].join(",")})`,
      );
    }
  }
  return rows;
}

(async () => {
  const rows = [];
  let rank = 100; // rank = 100 + brand index + 10 * item index, so brands alternate
  for (const arg of process.argv.slice(2)) {
    const [brand, domain] = arg.split("=");
    const brandRowsList = await brandRows(brand, domain, rank);
    rows.push(...brandRowsList);
    rank += 1;
    console.error(`${brand}: ${brandRowsList.length} items`);
  }
  console.log(
    "insert into public.explore_outfits(id,name,style,category,description,brand,tags,image,palette,source_label,source_url,photo_url,price_label,published,rank) values\n" +
      rows.join(",\n") +
      "\non conflict(id) do update set name=excluded.name,photo_url=excluded.photo_url,price_label=excluded.price_label,source_url=excluded.source_url,published=true;",
  );
})();
