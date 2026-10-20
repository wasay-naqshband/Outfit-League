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

let admin;
const users = [],
  paths = [],
  itemIds = [];
let passed = 0;
function check(ok, label) {
  if (!ok) throw new Error("Check failed: " + label);
  passed++;
  console.log("PASS " + label);
}
(async () => {
  admin = createClient(url.origin, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jpeg = fs.readFileSync("tests/fixtures/sample.jpg");
  async function account() {
    const password = crypto.randomBytes(24).toString("base64url");
    const email =
      "outfit-league-test-" + crypto.randomUUID() + "@outfitleague.test";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { integration_test: true },
    });
    if (created.error || !created.data.user)
      throw new Error("Temporary account creation failed.");
    users.push(created.data.user.id);
    const client = createClient(url.origin, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error("Temporary account sign-in failed.");
    return { client, id: created.data.user.id };
  }

  const guest = createClient(url.origin, publicKey, {
    auth: { persistSession: false },
  });
  const feed = await guest.rpc("explore_page", {
    search_text: "",
    style_filter: "",
    after_rank: -1,
    page_size: 2,
  });
  check(
    !feed.error && feed.data.length === 2,
    "anonymous catalog pagination works",
  );
  const next = await guest.rpc("explore_page", {
    search_text: "",
    style_filter: "",
    after_rank: feed.data[1].rank,
    page_size: 2,
  });
  check(
    !next.error &&
      next.data.length === 2 &&
      next.data.every((x) => !feed.data.some((y) => x.id === y.id)),
    "next page has no duplicates",
  );
  const search = await guest.rpc("explore_page", {
    search_text: "VARSITY",
    style_filter: "Y2K",
  });
  check(
    !search.error && search.data.length === 1 && search.data[0].id === "green",
    "server search and style filter combine",
  );
  const empty = await guest.rpc("explore_page", {
    search_text: "no-outfit-with-this-name",
    style_filter: "",
  });
  check(!empty.error && empty.data.length === 0, "empty search is real");
  const noSave = await guest.rpc("save_explore", { outfit_id: "navy" });
  check(!!noSave.error, "guest cannot save private inspiration");
  const noPublish = await guest
    .from("explore_outfits")
    .insert({ id: "forbidden" });
  check(!!noPublish.error, "clients cannot publish catalog entries");
  const a = await account(),
    b = await account();
  const saves = await Promise.all(
    Array.from({ length: 4 }, () =>
      a.client.rpc("save_explore", { outfit_id: "navy" }),
    ),
  );
  check(
    saves.every((x) => !x.error && x.data === saves[0].data),
    "concurrent repeated saves return one item",
  );
  const id = saves[0].data;
  const saved = await a.client
    .from("library_items")
    .select("*")
    .eq("id", id)
    .single();
  check(
    !saved.error &&
      saved.data.kind === "inspiration" &&
      saved.data.explore_garment === "navy" &&
      saved.data.explore_image === "navy" &&
      saved.data.notes.includes("Source: Outfit League"),
    "snapshot preserves image, garment, metadata and source",
  );
  const other = await b.client.from("library_items").select("id").eq("id", id);
  check(
    !other.error && other.data.length === 0,
    "saved inspiration remains private",
  );
  const forged = await a.client
    .from("library_items")
    .update({ explore_image: "rust" })
    .eq("id", id);
  check(!!forged.error, "clients cannot forge catalog snapshots");
  const invalid = await a.client.rpc("save_explore", {
    outfit_id: "missing-outfit",
  });
  check(!!invalid.error, "missing catalog item cannot be saved");
  const reload = await a.client
    .from("library_items")
    .select("id")
    .eq("explore_id", "navy");
  check(
    !reload.error && reload.data.length === 1 && reload.data[0].id === id,
    "saved item persists across independent requests",
  );
  const wallet = await a.client
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  check(
    !wallet.error && wallet.data.available === 3 && wallet.data.reserved === 0,
    "Explore consumes no AI credits",
  );
  const deleted = await a.client
    .from("library_items")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  check(!deleted.error, "owner can remove Explore inspiration");
  const resave = await a.client.rpc("save_explore", { outfit_id: "navy" });
  check(
    !resave.error && resave.data !== id,
    "saving again after deletion creates a fresh private item",
  );
  console.log(
    "Hosted Explore checks passed: " + passed + ". No AI calls or emails.",
  );
})()
  .catch(() => {
    console.error("Hosted library test failed; no private diagnostics logged.");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (admin) {
      if (paths.length)
        await admin.storage.from("library-private").remove(paths);
      if (itemIds.length)
        await admin.from("library_items").delete().in("id", itemIds);
      if (paths.length)
        await admin.from("library_cleanup").delete().in("path", paths);
      for (const id of users) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) {
          process.exitCode = 1;
          console.error("Temporary test account cleanup requires attention.");
        }
      }
    }
    console.log("Temporary library test records and accounts removed.");
  });
