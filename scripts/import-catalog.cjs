// Explicit integration test: temporary accounts only, no email and no AI calls.
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
function parse(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const p = line.indexOf("=");
        return [
          line.slice(0, p).trim(),
          line
            .slice(p + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}
const config = parse(".env"),
  url = new URL(config.EXPO_PUBLIC_SUPABASE_URL),
  publicKey =
    config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    config.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (
  url.protocol !== "https:" ||
  !/^[a-z]{20}\.supabase\.co$/.test(url.hostname)
)
  throw new Error("Hosted tests require the verified Supabase project URL.");
const pkgFile = require.resolve("supabase/package.json"),
  pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")),
  cli = path.resolve(
    path.dirname(pkgFile),
    typeof pkg.bin === "string" ? pkg.bin : pkg.bin.supabase,
  );
function adminKey() {
  const result = cp.spawnSync(
    process.execPath,
    [
      cli,
      "projects",
      "api-keys",
      "--project-ref",
      url.hostname.split(".")[0],
      "--reveal",
      "--output-format",
      "json",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      "CLI authorization is required. No credentials were logged.",
    );
  const data = JSON.parse(result.stdout);
  const keys = Array.isArray(data) ? data : (data.api_keys ?? data.keys ?? []);
  const key =
    keys.find((item) => item.name === "service_role") ??
    keys.find((item) => item.type === "secret" && item.api_key);
  if (!key?.api_key || key.api_key.includes("..."))
    throw new Error(
      "Could not obtain a server test credential. No credentials were logged.",
    );
  return key.api_key;
}
// Operator-only import. A retailer must already be approved in the database.
(async () => {
  const file = process.argv[2],
    apply = process.argv.includes("--apply");
  if (!file)
    throw Error("Usage: node scripts/import-catalog.cjs FEED.json [--apply]");
  if (fs.statSync(file).size > 5 * 1024 * 1024)
    throw Error("Feed exceeds 5 MB.");
  const feed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    typeof feed.retailer_id !== "string" ||
    !/^[a-z0-9-]{1,64}$/.test(feed.retailer_id) ||
    !Array.isArray(feed.products) ||
    feed.products.length > 1000
  )
    throw Error("Invalid feed envelope.");
  const allowed = [
    "external_id",
    "name",
    "category",
    "color",
    "brand",
    "tags",
    "price_minor",
    "currency",
    "product_url",
    "image_url",
    "availability",
    "price_checked_at",
    "expires_at",
  ];
  const seen = new Set(),
    now = Date.now();
  for (const item of feed.products) {
    if (
      Object.keys(item).some((k) => !allowed.includes(k)) ||
      typeof item.external_id !== "string" ||
      !item.external_id ||
      seen.has(item.external_id) ||
      !Number.isSafeInteger(item.price_minor) ||
      item.price_minor < 0 ||
      item.price_minor > 100000000 ||
      item.currency !== "USD" ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 100 ||
      ![
        "Tops",
        "Shirts",
        "Hoodies",
        "Jackets",
        "Bottoms",
        "Dresses",
        "Shoes",
        "Accessories",
        "Other",
      ].includes(item.category)
    )
      throw Error("Invalid product record.");
    seen.add(item.external_id);
    for (const key of ["product_url", "image_url"]) {
      const target = new URL(item[key]);
      if (
        target.protocol !== "https:" ||
        target.username ||
        target.password ||
        target.port ||
        !target.pathname ||
        /^(localhost|\[|\d+\.)/i.test(target.hostname)
      )
        throw Error("Invalid product URL.");
    }
    const checked = Date.parse(item.price_checked_at),
      expires = Date.parse(item.expires_at);
    if (
      !Number.isFinite(checked) ||
      !Number.isFinite(expires) ||
      checked > now ||
      checked < now - 86400000 ||
      expires <= now ||
      expires > checked + 86400000
    )
      throw Error("Price timestamp or expiry is invalid.");
    if (
      item.availability &&
      !["unknown", "in_stock", "out_of_stock"].includes(item.availability)
    )
      throw Error("Invalid availability.");
  }
  console.log(
    JSON.stringify({
      validated: feed.products.length,
      apply,
      market: "US",
      currency: "USD",
      completeSnapshot: true,
    }),
  );
  if (!apply) {
    console.log(
      "Dry run only. No database writes. Missing products will be unpublished on apply.",
    );
    return;
  }
  const admin = createClient(url.origin, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await admin.rpc("import_catalog", {
    p_retailer: feed.retailer_id,
    p_products: feed.products,
  });
  if (result.error)
    throw Error(
      "Import refused. Verify retailer permission, exact approved product/image hosts, and feed fields. No partial snapshot was published.",
    );
  console.log(JSON.stringify({ imported: result.data }));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
