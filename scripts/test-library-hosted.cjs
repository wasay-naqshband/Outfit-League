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

  const a = await account(),
    b = await account();
  const id = crypto.randomUUID();
  itemIds.push(id);
  const item = await a.client
    .from("library_items")
    .insert({
      id,
      kind: "wardrobe",
      name: "Integration test jacket",
      category: "Jackets",
      color: "Blue",
      tags: "test",
    })
    .select()
    .single();
  check(
    !item.error && item.data.owner_id === a.id,
    "owner can create a wardrobe item",
  );
  const foreign = await b.client.from("library_items").select("*").eq("id", id);
  check(
    !foreign.error && foreign.data.length === 0,
    "another account cannot read wardrobe metadata",
  );
  const imagePath = a.id + "/" + id + "/" + crypto.randomUUID() + ".jpg";
  paths.push(imagePath);
  const uploaded = await a.client.storage
    .from("library-private")
    .upload(imagePath, jpeg, { contentType: "image/jpeg" });
  check(!uploaded.error, "owner can upload a private JPEG");
  const attached = await a.client
    .from("library_items")
    .update({ photo_path: imagePath, notes: "Saved across sessions" })
    .eq("id", id)
    .select()
    .single();
  check(
    !attached.error && attached.data.photo_path === imagePath,
    "photo attaches to its owning library item",
  );
  const photo = await a.client.storage
    .from("library-private")
    .download(imagePath);
  check(
    !photo.error && photo.data.size === jpeg.length,
    "owner can retrieve original garment for Try On",
  );
  const denied = await b.client.storage
    .from("library-private")
    .download(imagePath);
  check(!!denied.error, "another account cannot download the photo");
  const signed = await a.client.storage
    .from("library-private")
    .createSignedUrl(imagePath, 60);
  check(
    !signed.error && !!signed.data.signedUrl,
    "owner can obtain a short-lived preview",
  );
  const publicUrl = a.client.storage
    .from("library-private")
    .getPublicUrl(imagePath).data.publicUrl;
  const publicResponse = await fetch(publicUrl);
  check(!publicResponse.ok, "library bucket does not expose public photos");
  const blocked = await b.client
    .from("library_items")
    .update({ name: "Foreign edit" })
    .eq("id", id)
    .select();
  check(
    !blocked.error && blocked.data.length === 0,
    "foreign edits cannot change an item",
  );
  const edited = await a.client
    .from("library_items")
    .update({ name: "Updated jacket", brand: "Test brand" })
    .eq("id", id)
    .select()
    .single();
  check(
    !edited.error &&
      edited.data.name === "Updated jacket" &&
      edited.data.notes === "Saved across sessions",
    "editing preserves the rest of the item",
  );
  const inspirationId = crypto.randomUUID();
  itemIds.push(inspirationId);
  const inspiration = await a.client
    .from("library_items")
    .insert({
      id: inspirationId,
      kind: "inspiration",
      name: "Source-only inspiration",
      source_url: "https://example.com/look",
    })
    .select()
    .single();
  check(
    !inspiration.error && inspiration.data.photo_path === null,
    "URL-only import works without extracting social media",
  );
  const invalid = await a.client.from("library_items").insert({
    kind: "inspiration",
    name: "Unsafe link",
    source_url: "javascript:alert(1)",
  });
  check(!!invalid.error, "non-web source links are rejected");
  const deleted = await a.client
    .from("library_items")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  check(!deleted.error, "owner can delete an item");
  const noRead = await a.client.storage
    .from("library-private")
    .createSignedUrl(imagePath, 60);
  check(!!noRead.error, "deleted item cannot issue a new signed photo URL");
  const queued = await admin
    .from("library_cleanup")
    .select("path")
    .eq("path", imagePath);
  const exists = await admin.storage
    .from("library-private")
    .download(imagePath);
  check(
    queued.data?.length === 1 || !!exists.error,
    "deletion is queued for durable cleanup or already cleaned",
  );
  const wallet = await a.client
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  check(
    !wallet.error && wallet.data.available === 3 && wallet.data.reserved === 0,
    "saving and deleting library items consumes no AI credits",
  );
  console.log(
    "Hosted library checks passed: " +
      passed +
      ". No AI requests or emails sent.",
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
