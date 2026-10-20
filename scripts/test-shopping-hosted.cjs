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

let passed = 0;
function check(ok, label) {
  if (!ok) throw new Error("Check failed: " + label);
  passed++;
  console.log("PASS " + label);
}
(async () => {
  const guest = createClient(url.origin, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url.origin, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const before = await admin
    .from("affiliate_clicks")
    .select("request_id", { count: "exact", head: true });
  const all = await guest.rpc("catalog_page", { p_limit: 40 });
  check(
    !all.error && all.data.length === 10 && all.data.every((x) => x.is_demo),
    "public catalog contains ten explicitly marked demo products",
  );
  check(
    all.data.every(
      (x) => x.product_url === null && x.availability === "unknown",
    ),
    "sample entries do not fabricate retailer links or stock",
  );
  const first = await guest.rpc("catalog_page", {
    p_category: "Jackets",
    p_limit: 2,
  });
  const next = await guest.rpc("catalog_page", {
    p_category: "Jackets",
    p_limit: 2,
    p_after_price: first.data[1].price_minor,
    p_after_id: first.data[1].id,
  });
  check(
    !next.error &&
      next.data.length === 2 &&
      next.data.every((x) => !first.data.some((y) => y.id === x.id)),
    "price-and-ID cursor pages do not repeat entries",
  );
  const search = await guest.rpc("catalog_page", {
    p_category: "Jackets",
    p_search: "NAVY",
  });
  check(
    !search.error && search.data.length === 2,
    "catalog names/colors/tags are searched on the server",
  );
  const budget = await guest.rpc("catalog_page", {
    p_category: "Jackets",
    p_max_minor: 4200,
  });
  check(
    !budget.error &&
      budget.data.length === 2 &&
      budget.data.every((x) => x.price_minor < 4200),
    "budget is a strict same-currency price ceiling",
  );
  const otherCurrency = await guest.rpc("catalog_page", { p_currency: "PKR" });
  check(
    !otherCurrency.error && otherCurrency.data.length === 0,
    "catalog never silently converts or mixes currencies",
  );
  const exact = await guest.rpc("catalog_page", { p_exact_explore: "navy" });
  check(
    !exact.error && exact.data.length === 0,
    "visual similarity is not labeled an exact match",
  );
  const spoof = await guest
    .from("products")
    .update({ price_minor: 1 })
    .eq("id", "navy-bomber");
  check(!!spoof.error, "clients cannot fabricate catalog prices");
  const proof = await guest.from("product_matches").insert({
    explore_id: "navy",
    product_id: "rust-jacket",
    relation: "exact",
  });
  check(!!proof.error, "clients cannot forge exact verification");
  const clickRead = await guest.from("affiliate_clicks").select("*");
  check(
    !!clickRead.error,
    "private outbound click records are not readable by guests",
  );
  const demo = await guest.functions.invoke("shopping", {
    body: {
      action: "outbound",
      product: "navy-bomber",
      requestId: crypto.randomUUID(),
    },
  });
  const demoError = demo.error
    ? await demo.error.context?.json().catch(() => null)
    : demo.data;
  check(
    demoError?.error === "DEMO_PRODUCT",
    "demo products cannot redirect to fabricated retailers",
  );
  const invalid = await guest.functions.invoke("shopping", {
    body: {
      action: "outbound",
      product: "missing-product",
      requestId: crypto.randomUUID(),
    },
  });
  const invalidError = invalid.error
    ? await invalid.error.context?.json().catch(() => null)
    : invalid.data;
  check(
    invalidError?.error === "NOT_FOUND",
    "unknown products cannot become outbound links",
  );
  const after = await admin
    .from("affiliate_clicks")
    .select("request_id", { count: "exact", head: true });
  check(
    before.count === after.count,
    "rejected demo and missing-product clicks create no affiliate events",
  );
  console.log(
    "Hosted shopping checks passed: " +
      passed +
      ". No purchases, AI calls or test accounts.",
  );
})().catch((error) => {
  console.error(
    error.message?.startsWith("Check failed:")
      ? error.message
      : "Shopping verification failed; private diagnostics withheld.",
  );
  process.exitCode = 1;
});
