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
  const admin = createClient(url.origin, adminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    ids = [],
    files = [];
  async function api(client, body) {
    const r = await client.functions.invoke("account", { body });
    if (r.error)
      return {
        error:
          (await r.error.context?.json().catch(() => null))?.error ?? "FAILED",
      };
    return r.data;
  }
  try {
    async function account() {
      const email =
          "ol-account-test-" + crypto.randomUUID() + "@outfitleague.test",
        password = crypto.randomBytes(24).toString("base64url");
      const r = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { integration_test: true },
      });
      if (r.error) throw Error("Fixture account failed");
      ids.push(r.data.user.id);
      const c = createClient(url.origin, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if ((await c.auth.signInWithPassword({ email, password })).error)
        throw Error("Fixture sign-in failed");
      return { id: r.data.user.id, c };
    }
    const owner = await account(),
      moderator = await account();
    check(
      (await api(owner.c, { action: "reports" })).error === "FORBIDDEN",
      "ordinary account cannot read reports",
    );
    check(
      (await api(owner.c, { action: "hide", id: crypto.randomUUID() }))
        .error === "FORBIDDEN",
      "ordinary account cannot hide battles",
    );
    check(
      !!(await owner.c.from("moderators").insert({ owner_id: owner.id })).error,
      "client cannot appoint itself administrator",
    );
    check(
      !(
        await owner.c
          .from("profiles")
          .update({ display_name: "Fixture voter" })
          .eq("id", owner.id)
      ).error,
      "owner can persist display name",
    );
    const saved1 = await owner.c.rpc("save_explore", { outfit_id: "navy" }),
      saved2 = await owner.c.rpc("save_explore", { outfit_id: "green" });
    const battle = crypto.randomUUID(),
      browser = crypto.randomUUID();
    async function battleApi(c, body) {
      const r = await c.functions.invoke("battles", {
        body: { ...body, token: browser, id: battle },
      });
      if (r.error)
        return {
          error:
            (await r.error.context?.json().catch(() => null))?.error ??
            "FAILED",
        };
      return r.data;
    }
    check(
      !(
        await battleApi(owner.c, {
          action: "create",
          title: "Disposable account-control fixture",
          mode: "anonymous",
          aKind: "library",
          aId: saved1.data,
          bKind: "library",
          bId: saved2.data,
        })
      ).error,
      "disposable battle created",
    );
    check(
      !(await battleApi(owner.c, { action: "publish", consent: true })).error,
      "fixture battle published with explicit consent",
    );
    await admin
      .from("battle_reports")
      .insert({ battle_id: battle, reporter_key: "fixture", reason: "Other" });
    await admin.from("moderators").insert({ owner_id: moderator.id });
    check(
      (await api(moderator.c, { action: "reports" })).reports.some(
        (x) => x.battle_id === battle,
      ),
      "appointed moderator sees fixture report",
    );
    check(
      !(await api(moderator.c, { action: "hide", id: battle })).error,
      "appointed moderator hides fixture",
    );
    check(
      (
        await admin
          .from("moderation_actions")
          .select("id")
          .eq("battle_id", battle)
      ).data.length === 1,
      "moderation action audited",
    );
    const jpeg = fs.readFileSync("tests/fixtures/sample.jpg"),
      asset = crypto.randomUUID(),
      photo = owner.id + "/" + asset + ".jpg";
    files.push({ bucket: "tryon-private", path: photo });
    await admin.from("private_assets").insert({
      id: asset,
      owner_id: owner.id,
      kind: "person",
      path: photo,
      byte_size: jpeg.length,
      content_type: "image/jpeg",
    });
    check(
      !(
        await admin.storage
          .from("tryon-private")
          .upload(photo, jpeg, { contentType: "image/jpeg" })
      ).error,
      "private fixture file uploaded",
    );
    const libraryPhoto = `${owner.id}/${saved1.data}/${crypto.randomUUID()}.jpg`;
    const battlePhoto = battle + "/a.jpg";
    files.push(
      { bucket: "library-private", path: libraryPhoto },
      { bucket: "battle-images", path: battlePhoto },
    );
    check(
      !(
        await owner.c.storage
          .from("library-private")
          .upload(libraryPhoto, jpeg, { contentType: "image/jpeg" })
      ).error,
      "owner-authenticated nested library photo uploaded",
    );
    check(
      !(
        await owner.c
          .from("library_items")
          .update({ photo_path: libraryPhoto })
          .eq("id", saved1.data)
      ).error,
      "library fixture references its photo",
    );
    check(
      !(
        await admin.storage
          .from("battle-images")
          .upload(battlePhoto, jpeg, { contentType: "image/jpeg" })
      ).error,
      "fixture-only battle snapshot stored",
    );
    await admin
      .from("battles")
      .update({ a_path: battlePhoto })
      .eq("id", battle);
    check(
      (await api(owner.c, { action: "delete", confirmation: "wrong" }))
        .error === "INVALID_REQUEST",
      "deletion requires exact confirmation",
    );
    check(
      (await api(owner.c, { action: "delete", confirmation: "DELETE" }))
        .accepted === true,
      "freshly authenticated fixture deletion accepted",
    );
    check(
      (await owner.c.from("library_items").select("id")).data?.length === 0,
      "old access token cannot read private collection",
    );
    const guest = createClient(url.origin, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    check(
      !!(await battleApi(guest, { action: "view" })).error,
      "deleted owner battle link unavailable",
    );
    check(
      (
        await admin
          .from("account_deletions")
          .select("owner_id")
          .eq("owner_id", owner.id)
      ).data.length === 1,
      "durable cleanup request exists",
    );
    // Only backdate this disposable fixture. Do not run AI reconciliation.
    await admin
      .from("account_deletions")
      .update({
        requested_at: new Date(Date.now() - 131 * 60000).toISOString(),
      })
      .eq("owner_id", owner.id);
    const privateConfig = parse("supabase/.env.server");
    const cleanup = await fetch(url.origin + "/functions/v1/account", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: publicKey,
        "x-worker-secret": privateConfig.TRYON_WORKER_SECRET,
      },
      body: JSON.stringify({ action: "reconcile" }),
    });
    check(cleanup.ok, "private cleanup worker endpoint runs without AI calls");
    check(
      !!(await admin.auth.admin.getUserById(owner.id)).error,
      "worker removes fixture auth account",
    );
    check(
      !!(await admin.storage.from("tryon-private").download(photo)).error,
      "worker removes fixture photo bytes",
    );
    check(
      !!(await admin.storage.from("library-private").download(libraryPhoto))
        .error,
      "worker removes nested owner-authenticated library photo",
    );
    check(
      !!(await admin.storage.from("battle-images").download(battlePhoto)).error,
      "worker removes battle snapshot bytes",
    );
    check(
      (
        await admin
          .from("account_deletions")
          .select("owner_id")
          .eq("owner_id", owner.id)
      ).data.length === 0,
      "completed queue entry removed",
    );
    check(
      (await admin.from("battles").select("id").eq("id", battle)).data
        .length === 0,
      "fixture battle and account data cascade deleted",
    );
    console.log(passed + " hosted account checks passed. No AI or purchases.");
  } finally {
    for (const file of files)
      await admin.storage.from(file.bucket).remove([file.path]);
    for (const id of ids) {
      await admin.from("moderation_actions").delete().eq("moderator_id", id);
      await admin.auth.admin.deleteUser(id);
      await admin.from("account_deletions").delete().eq("owner_id", id);
      await admin.from("account_cleanup").delete().eq("owner_id", id);
    }
  }
})().catch(() => {
  console.error("Hosted account check failed. No credentials logged.");
  process.exitCode = 1;
});
