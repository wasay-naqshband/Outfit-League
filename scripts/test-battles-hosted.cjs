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
const battleIds = [],
  tryonPaths = [];
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
  const guest = createClient(url.origin, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tokens = {
    a: crypto.randomUUID(),
    b: crypto.randomUUID(),
    guest: crypto.randomUUID(),
  };
  async function api(client, body, token) {
    const value = await client.functions.invoke("battles", {
      body: { ...body, token },
    });
    if (value.error) {
      const payload = await value.error.context?.json().catch(() => null);
      return { error: payload?.error ?? "REQUEST_FAILED" };
    }
    return value.data;
  }
  const first = await a.client.rpc("save_explore", { outfit_id: "navy" }),
    second = await a.client.rpc("save_explore", { outfit_id: "green" });
  check(!first.error && !second.error, "owned sample sources prepared");
  const id = crypto.randomUUID();
  battleIds.push(id);
  const created = await api(
    a.client,
    {
      action: "create",
      id,
      title: "Disposable anonymous battle",
      mode: "anonymous",
      aKind: "library",
      aId: first.data,
      bKind: "library",
      bId: second.data,
    },
    tokens.a,
  );
  check(
    !created.error &&
      created.ready &&
      created.status === "draft" &&
      created.aSample === "navy",
    "private sample preview is ready",
  );
  const privateView = await api(guest, { action: "view", id }, tokens.guest);
  check(privateView.error === "NOT_FOUND", "draft is inaccessible to guests");
  const stolen = await api(
    b.client,
    {
      action: "create",
      id: crypto.randomUUID(),
      title: "Denied",
      mode: "anonymous",
      aKind: "library",
      aId: first.data,
      bKind: "library",
      bId: second.data,
    },
    tokens.b,
  );
  check(
    stolen.error === "INVALID_SOURCE",
    "foreign private sources cannot be copied",
  );
  const noConsent = await api(a.client, { action: "publish", id }, tokens.a);
  check(
    noConsent.error === "PUBLISH_CONSENT_REQUIRED",
    "publishing requires explicit consent",
  );
  const published = await api(
    a.client,
    { action: "publish", id, consent: true },
    tokens.a,
  );
  check(
    published.status === "published",
    "owner publishes selected sample snapshots",
  );
  const publicView = await api(guest, { action: "view", id }, tokens.guest);
  check(
    !publicView.error &&
      !("owner_id" in publicView) &&
      !("source_a_id" in publicView),
    "guest sees battle without private source or owner identifiers",
  );
  const votes = await Promise.all(
    Array.from({ length: 3 }, () =>
      api(
        guest,
        { action: "vote", id, choice: "A", name: "Should not appear" },
        tokens.guest,
      ),
    ),
  );
  check(
    votes.every((x) => !x.error && x.counts.A === 1 && x.mine === "A"),
    "concurrent anonymous votes count once",
  );
  const repeat = await api(
    guest,
    { action: "vote", id, choice: "B" },
    tokens.guest,
  );
  check(
    repeat.counts.A === 1 &&
      repeat.counts.B === 0 &&
      repeat.voters.length === 0,
    "repeat vote cannot change choice or reveal anonymous names",
  );
  const anonymousRows = await admin
    .from("battle_votes")
    .select("display_name")
    .eq("battle_id", id);
  check(
    anonymousRows.data?.every((x) => x.display_name === null),
    "anonymous names are not stored",
  );
  const direct = await b.client.from("battle_votes").select("*");
  check(!!direct.error, "raw votes cannot be read by clients");
  const report = await api(
    guest,
    { action: "report", id, reason: "Privacy concern" },
    tokens.guest,
  );
  check(report.reported === true, "report is recorded privately");
  const foreignManage = await api(
    b.client,
    { action: "unpublish", id },
    tokens.b,
  );
  check(
    foreignManage.error === "NOT_FOUND",
    "other users cannot unpublish a battle",
  );
  const closed = await api(a.client, { action: "close", id }, tokens.a);
  const closedVote = await api(
    b.client,
    { action: "vote", id, choice: "B" },
    tokens.b,
  );
  check(
    closed.status === "closed" && closedVote.error === "VOTING_CLOSED",
    "close retains results and rejects new votes",
  );
  await api(a.client, { action: "unpublish", id }, tokens.a);
  check(
    (await api(guest, { action: "view", id }, tokens.guest)).error ===
      "NOT_FOUND",
    "unpublish removes guest access",
  );
  const namedId = crypto.randomUUID();
  battleIds.push(namedId);
  await api(
    a.client,
    {
      action: "create",
      id: namedId,
      title: "Disposable public vote battle",
      mode: "public",
      aKind: "library",
      aId: first.data,
      bKind: "library",
      bId: second.data,
    },
    tokens.a,
  );
  await api(
    a.client,
    { action: "publish", id: namedId, consent: true },
    tokens.a,
  );
  check(
    (
      await api(
        guest,
        {
          action: "vote",
          id: namedId,
          choice: "A",
          name: "Guest",
          publicConsent: true,
        },
        tokens.guest,
      )
    ).error === "PUBLIC_IDENTITY_REQUIRED",
    "guest cannot claim a public voter identity",
  );
  check(
    (
      await api(
        b.client,
        { action: "vote", id: namedId, choice: "B", name: "Test friend" },
        tokens.b,
      )
    ).error === "PUBLIC_IDENTITY_REQUIRED",
    "public vote requires separate visibility consent",
  );
  const named = await api(
    b.client,
    {
      action: "vote",
      id: namedId,
      choice: "B",
      name: "Test friend",
      publicConsent: true,
    },
    tokens.b,
  );
  check(
    named.counts.B === 1 &&
      named.voters[0]?.display_name === "Test friend" &&
      named.voters[0]?.choice === "B",
    "consenting signed-in public vote exposes name and choice",
  );
  const namedGuest = await api(
    guest,
    { action: "view", id: namedId },
    tokens.guest,
  );
  check(
    namedGuest.voters.length === 1 && !("voter_key" in namedGuest.voters[0]),
    "public voter list never exposes internal voter keys",
  );
  const forge = await a.client
    .from("battles")
    .update({ voting_mode: "anonymous" })
    .eq("id", namedId);
  check(!!forge.error, "vote privacy cannot be changed after creation");
  await admin.from("battles").update({ status: "hidden" }).eq("id", namedId);
  check(
    (await api(guest, { action: "view", id: namedId }, tokens.guest)).error ===
      "NOT_FOUND",
    "moderation hiding blocks guest access",
  );
  const photoId = crypto.randomUUID(),
    photoPath = a.id + "/" + photoId + "/" + crypto.randomUUID() + ".jpg";
  paths.push(photoPath);
  check(
    !(
      await a.client.from("library_items").insert({
        id: photoId,
        kind: "wardrobe",
        name: "Disposable photo source",
      })
    ).error,
    "private photo source created",
  );
  check(
    !(
      await a.client.storage
        .from("library-private")
        .upload(photoPath, jpeg, { contentType: "image/jpeg" })
    ).error,
    "private source photo uploaded",
  );
  await a.client
    .from("library_items")
    .update({ photo_path: photoPath })
    .eq("id", photoId);
  const photoBattle = crypto.randomUUID();
  battleIds.push(photoBattle);
  const photoPreview = await api(
    a.client,
    {
      action: "create",
      id: photoBattle,
      title: "Disposable photo snapshot",
      mode: "anonymous",
      aKind: "library",
      aId: photoId,
      bKind: "library",
      bId: second.data,
    },
    tokens.a,
  );
  check(
    photoPreview.ready && !!photoPreview.aUrl && !photoPreview.aSample,
    "selected photo is copied into a separate private battle snapshot",
  );
  check(
    (
      await guest.storage
        .from("battle-images")
        .createSignedUrl(photoBattle + "/a.jpg", 60)
    ).error,
    "guest cannot sign battle storage directly",
  );
  const snapshot = await fetch(photoPreview.aUrl);
  check(
    snapshot.ok && (await snapshot.arrayBuffer()).byteLength === jpeg.length,
    "battle snapshot preserves the selected photo bytes",
  );
  const pubPhoto = await api(
    a.client,
    { action: "publish", id: photoBattle, consent: true },
    tokens.a,
  );
  const viewPhoto = await api(
    guest,
    { action: "view", id: photoBattle },
    tokens.guest,
  );
  check(
    pubPhoto.status === "published" &&
      !!viewPhoto.aUrl &&
      !viewPhoto.aUrl.includes("library-private"),
    "published view issues only battle snapshot URLs",
  );
  await api(a.client, { action: "unpublish", id: photoBattle }, tokens.a);
  check(
    (await api(guest, { action: "view", id: photoBattle }, tokens.guest))
      .error === "NOT_FOUND",
    "unpublished photo cannot issue new guest preview links",
  );
  // Fixture job: no provider request and no credit transitions. Only its result
  // object exists; input photo paths must never be included in battle output.
  const assetIds = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const assetRows = assetIds.map((asset, index) => ({
    id: asset,
    owner_id: a.id,
    kind: ["person", "garment", "result"][index],
    path: a.id + "/" + asset + ".jpg",
    byte_size: jpeg.length,
    content_type: "image/jpeg",
  }));
  check(
    !(await admin.from("private_assets").insert(assetRows)).error,
    "completed-look fixture assets created privately",
  );
  const jobId = crypto.randomUUID(),
    resultPath = assetRows[2].path;
  tryonPaths.push(resultPath);
  check(
    !(
      await admin.storage
        .from("tryon-private")
        .upload(resultPath, jpeg, { contentType: "image/jpeg" })
    ).error,
    "completed-look result fixture uploaded",
  );
  check(
    !(
      await admin.from("try_on_jobs").insert({
        id: jobId,
        owner_id: a.id,
        idempotency_key: crypto.randomUUID(),
        person_asset_id: assetIds[0],
        garment_asset_id: assetIds[1],
        result_asset_id: assetIds[2],
        status: "completed",
        consent_version: "tryon-v1",
      })
    ).error,
    "completed-look fixture prepared without an AI call",
  );
  const aiBattle = crypto.randomUUID();
  battleIds.push(aiBattle);
  const aiPreview = await api(
    a.client,
    {
      action: "create",
      id: aiBattle,
      title: "Disposable completed-look snapshot",
      mode: "anonymous",
      aKind: "job",
      aId: jobId,
      bKind: "library",
      bId: second.data,
    },
    tokens.a,
  );
  check(
    aiPreview.ready &&
      aiPreview.aLabel === "AI preview" &&
      !!aiPreview.aUrl &&
      !("beforeUrl" in aiPreview),
    "AI battle copies and labels only the completed result",
  );
  const aiBytes = await fetch(aiPreview.aUrl);
  check(
    aiBytes.ok && (await aiBytes.arrayBuffer()).byteLength === jpeg.length,
    "completed result snapshot bytes are available privately",
  );
  const wallet = await a.client
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  check(
    wallet.data?.available === 3 && wallet.data?.reserved === 0,
    "battle creation, voting and sharing use no AI credits",
  );
  console.log(
    "Hosted battle checks passed: " + passed + ". No AI calls or emails.",
  );
})()
  .catch((error) => {
    console.error(
      "Hosted battle checks failed: " +
        (error.message?.startsWith("Check failed:")
          ? error.message
          : "private diagnostics withheld"),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (admin) {
      for (const battle of battleIds)
        await admin.storage
          .from("battle-images")
          .remove([battle + "/a.jpg", battle + "/b.jpg"]);
      if (battleIds.length)
        await admin.from("battles").delete().in("id", battleIds);
      if (paths.length)
        await admin.storage.from("library-private").remove(paths);
      if (tryonPaths.length)
        await admin.storage.from("tryon-private").remove(tryonPaths);
      for (const owner of users) {
        const result = await admin.auth.admin.deleteUser(owner);
        if (result.error) {
          console.error("Temporary test account cleanup requires attention.");
          process.exitCode = 1;
        }
      }
      if (paths.length)
        await admin.from("library_cleanup").delete().in("path", paths);
    }
    console.log("Disposable battle test records, images and accounts removed.");
  });
