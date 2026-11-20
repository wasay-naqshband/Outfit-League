// Re-applies scripts/catalog-classify.cjs to the Explore catalog seeded by
// supabase/migrations/202611200034_us_explore.sql and prints a migration.
// Usage: node scripts/reclassify-catalog.cjs --report      (stats + samples)
//        node scripts/reclassify-catalog.cjs > migration.sql
const fs = require("node:fs");
const path = require("node:path");
const {
  wearable,
  classifyKind,
  classifyStyle,
} = require("./catalog-classify.cjs");

const SEED = path.join(
  __dirname,
  "../supabase/migrations/202611200034_us_explore.sql",
);
const BRAND_STYLE = {};
for (const line of fs
  .readFileSync(path.join(__dirname, "brand-explore-seed.cjs"), "utf8")
  .matchAll(/"([^"=]+)=([^"=]+)=([A-Za-z0-9]+)"/g))
  BRAND_STYLE[line[1]] = line[3];

// Rows are `('id','name',...)` tuples of single-quoted strings and bare words.
function parseRows(sql) {
  const rows = [];
  let i = 0;
  while ((i = sql.indexOf("\n('", i)) >= 0) {
    let k = i + 1;
    const vals = [];
    for (;;) {
      k++; // skip "(" or ","
      while (sql[k] === " ") k++;
      if (sql[k] === "'") {
        let s = "";
        for (k++; ; k++) {
          if (sql[k] === "'" && sql[k + 1] === "'") {
            s += "'";
            k++;
          } else if (sql[k] === "'") {
            k++;
            break;
          } else s += sql[k];
        }
        vals.push(s);
      } else {
        const m = /^[^,)]+/.exec(sql.slice(k));
        vals.push(m[0]);
        k += m[0].length;
      }
      if (sql[k] === ")") break;
    }
    rows.push(vals);
    i = k;
  }
  return rows;
}

const rows = parseRows(fs.readFileSync(SEED, "utf8")).map((v) => {
  const [id, name, style, category, , brand, tags, , , , , , price, , rank] = v;
  // tags = `${brand} ${productType} ${kind} ${style} ${shopifyTags}`, lowercased.
  const body = tags.slice(brand.length + 1);
  const cut = body.search(
    new RegExp(` ${category.toLowerCase()} ${style.toLowerCase()}( |$)`),
  );
  const productType = body.slice(0, cut);
  const rest = body.slice(cut + category.length + style.length + 2).trim();
  return {
    id,
    name,
    oldStyle: style,
    oldKind: category,
    brand,
    tags,
    productType,
    rest,
    rank: Number(rank),
    price,
  };
});

// Signals for Trending: merchandiser tags the brand itself uses for its best items.
const HOT =
  /\b(best[- _]?sell\w*|top[- ]?rated|hype\w*|trending|popular|staff[- ]?pick|iconic)\b/i;
const NEW = /\b(new|newarrivals?|new[- ]arrivals?|just dropped|60-day-new)\b/i;
const COLD =
  /\b(final[- ]?sale|clearance|archive|last[- ]?chance|bestofsale)\b/i;

for (const r of rows) {
  const input = { title: r.name, productType: r.productType, tags: r.rest };
  r.wearable = wearable(input);
  r.kind = r.wearable ? classifyKind(input) : null;
  const s = classifyStyle({
    ...input,
    brandStyle: BRAND_STYLE[r.brand] ?? "Casual",
  });
  r.style = s.style;
  r.explicit = s.explicit;
  r.published = r.wearable && !!r.kind;
  r.score =
    (HOT.test(r.rest) ? 3 : 0) +
    (NEW.test(r.rest) ? 1 : 0) -
    (COLD.test(r.rest) ? 2 : 0);
  r.trending = r.published && r.kind !== "Accessories";
}

// Round-robin across brands (best signal first) so Trending is a real mix.
const byBrand = new Map();
for (const r of rows.filter((r) => r.trending)) {
  if (!byBrand.has(r.brand)) byBrand.set(r.brand, []);
  byBrand.get(r.brand).push(r);
}
const pos = new Map();
for (const list of byBrand.values()) {
  list.sort((a, b) => b.score - a.score || a.rank - b.rank);
  list.forEach((r, n) => pos.set(r.id, n));
}
const ordered = rows
  .filter((r) => r.trending)
  .sort(
    (a, b) =>
      pos.get(a.id) - pos.get(b.id) ||
      b.score - a.score ||
      a.brand.localeCompare(b.brand),
  );
const rest = rows.filter((r) => !r.trending).sort((a, b) => a.rank - b.rank);
[...ordered, ...rest].forEach((r, n) => (r.newRank = 1000 + n * 10));

if (process.argv.includes("--report")) {
  const count = (f) =>
    Object.entries(
      rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {}),
    ).sort((a, b) => b[1] - a[1]);
  console.log(
    "total",
    rows.length,
    "published",
    rows.filter((r) => r.published).length,
  );
  console.log("unpublished:", rows.filter((r) => !r.published).length);
  console.log(
    "kind",
    count((r) => (r.published ? r.kind : "(hidden)")),
  );
  console.log(
    "style",
    count((r) => (r.published ? r.style : "(hidden)")),
  );
  console.log(
    "kind changed",
    rows.filter((r) => r.published && r.kind !== r.oldKind).length,
  );
  console.log(
    "style changed",
    rows.filter((r) => r.published && r.style !== r.oldStyle).length,
  );
  const show = (title, list, n = 25) => {
    console.log("\n" + title);
    list
      .slice(0, n)
      .forEach((r) =>
        console.log(
          ` ${r.brand} | ${r.name} | ${r.productType} | ${r.oldKind}/${r.oldStyle} -> ${r.published ? r.kind + "/" + r.style : "HIDDEN"}`,
        ),
      );
  };
  show(
    "HIDDEN (non-wearable)",
    rows.filter((r) => !r.wearable),
    40,
  );
  show(
    "HIDDEN (no garment type)",
    rows.filter((r) => r.wearable && !r.kind),
    40,
  );
  show(
    "Shoes under old Tops",
    rows.filter((r) => r.oldKind === "Tops" && r.kind === "Shoes"),
    5,
  );
  show(
    "Kind changed sample",
    rows.filter((r) => r.published && r.kind !== r.oldKind),
    40,
  );
  show(
    "Style changed sample",
    rows.filter((r) => r.published && r.style !== r.oldStyle),
    40,
  );
  console.log("\nTRENDING top 24");
  ordered
    .slice(0, 24)
    .forEach((r) =>
      console.log(` ${r.brand} | ${r.name} | ${r.kind}/${r.style}`),
    );
  process.exit(0);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const tagsFor = (r) =>
  `${r.brand} ${r.productType} ${r.kind ?? r.oldKind} ${r.style} ${r.rest}`
    .toLowerCase()
    .slice(0, 300);
console.log(`-- Explore quality: hide non-wearables, fix garment types and styles, rank Trending.
-- Generated by scripts/reclassify-catalog.cjs from the shared rules in
-- scripts/catalog-classify.cjs; re-run it rather than editing the values.
alter table public.explore_outfits
  add column if not exists style_explicit boolean not null default false;

-- Garment tabs and style tabs match exactly one field each, and Trending only
-- shows wearable clothing and shoes (never accessories) unless searching.
create or replace function public.explore_page(
  search_text text default '', style_filter text default '',
  after_rank integer default -1, page_size integer default 12
) returns setof public.explore_outfits
language sql stable security invoker set search_path='' as $$
 select * from public.explore_outfits
 where published and rank > after_rank
   and (case
     when style_filter='' then trim(search_text)<>'' or category<>'Accessories'
     when style_filter in ('Tops','Shirts','Knitwear','Hoodies','Jackets','Denim','Bottoms','Dresses','Skirts','Shorts','Shoes','Accessories','Swimwear')
       then category=style_filter
     else style=style_filter and category<>'Accessories'
       or (style=style_filter and style_explicit)
     end)
   and (trim(search_text)='' or strpos(
     lower(name || ' ' || brand || ' ' || tags || ' ' || category),
     lower(left(trim(search_text),100))
   )>0)
 order by rank limit greatest(1,least(page_size,40))
$$;

-- Park every rank out of the way, then assign the new order (rank is unique).
update public.explore_outfits set rank=rank+10000000;
update public.explore_outfits e set
  published=v.published, category=v.category, style=v.style,
  style_explicit=v.explicit, tags=v.tags, rank=v.rank
from (values`);
const lines = rows.map(
  (r) =>
    `(${q(r.id)},${r.published},${q(r.kind ?? r.oldKind)},${q(r.style)},${r.explicit},${q(tagsFor(r))},${r.newRank})`,
);
console.log(lines.join(",\n"));
console.log(`) as v(id,published,category,style,explicit,tags,rank) where e.id=v.id;
-- Rows not listed above (older samples) keep their parked rank, after the catalog.
`);
