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
  paths = [];
let passed = 0;
function check(condition, label) {
  if (!condition) throw new Error("Check failed: " + label);
  passed++;
  console.log("PASS " + label);
}
async function invoke(client, body) {
  const response = await client.functions.invoke("tryon", { body });
  if (response.error) {
    let error;
    try {
      error = (await response.error.context.json()).error;
    } catch {}
    return { error: error ?? "HTTP_ERROR" };
  }
  return response.data;
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
  const credits = await a.client
    .from("credit_wallets")
    .select("available,reserved");
  check(
    !credits.error &&
      credits.data.length === 1 &&
      credits.data[0].available === 3,
    "signup grants three credits and wallet RLS isolates the account",
  );
  const mutation = await a.client
    .from("credit_wallets")
    .update({ available: 999 })
    .eq("owner_id", a.id);
  check(!!mutation.error, "client cannot edit credit balances");
  const remote = await invoke(a.client, { action: "config" });
  check(
    remote.enabled === false,
    "AI calls remain disabled during integration tests",
  );
  const uploadIds = [];
  for (const kind of ["person", "garment"]) {
    const ticket = await invoke(a.client, {
      action: "upload",
      kind,
      size: jpeg.length,
    });
    if (!ticket.id) throw new Error("Authenticated upload ticket failed.");
    paths.push(ticket.path);
    uploadIds.push(ticket.id);
    const upload = await a.client.storage
      .from("tryon-private")
      .uploadToSignedUrl(ticket.path, ticket.token, jpeg, {
        contentType: "image/jpeg",
        upsert: false,
      });
    check(!upload.error, "signed private " + kind + " upload works");
  }
  const crossAsset = await b.client
    .from("private_assets")
    .select("id")
    .eq("id", uploadIds[0]);
  check(
    !crossAsset.error && crossAsset.data.length === 0,
    "another account cannot see uploaded asset metadata",
  );
  const foreignRead = await b.client.storage
    .from("tryon-private")
    .createSignedUrl(paths[0], 60);
  check(!!foreignRead.error, "another account cannot sign a private photo URL");
  const publicRead = await fetch(
    url.origin + "/storage/v1/object/public/tryon-private/" + paths[0],
  );
  check(!publicRead.ok, "private photo cannot be fetched as a public object");
  const gated = await invoke(a.client, {
    action: "start",
    key: crypto.randomUUID(),
    person: uploadIds[0],
    garment: uploadIds[1],
    consent: "tryon-v1",
  });
  check(
    gated.error === "PROVIDER_NOT_CONFIGURED",
    "unconfigured provider cannot create a paid generation",
  );
  const args = {
    p_owner: a.id,
    p_key: crypto.randomUUID(),
    p_person: uploadIds[0],
    p_garment: uploadIds[1],
    p_consent: "tryon-v1",
  };
  const reserved = await admin.rpc("reserve_tryon", args),
    repeat = await admin.rpc("reserve_tryon", args);
  if (reserved.error) throw new Error("Hosted credit reservation failed.");
  const job = reserved.data.job.id;
  check(
    !repeat.error && !repeat.data.created && repeat.data.job.id === job,
    "hosted duplicate request is idempotent",
  );
  const inProgress = await a.client
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  check(
    inProgress.data.available === 2 && inProgress.data.reserved === 1,
    "hosted job reserves exactly one credit",
  );
  const status = await invoke(a.client, { action: "status", id: job });
  check(
    status.job?.id === job && !!status.beforeUrl,
    "owner can reopen private job and original photo",
  );
  const foreign = await invoke(b.client, { action: "status", id: job });
  check(
    foreign.error === "NOT_FOUND",
    "another account cannot access the job endpoint",
  );
  const clientRefund = await a.client.rpc("finish_tryon", {
    p_job: job,
    p_error: "GENERATION_FAILED",
  });
  check(!!clientRefund.error, "client cannot issue its own credit refund");
  await admin.rpc("finish_tryon", { p_job: job, p_error: "GENERATION_FAILED" });
  await admin.rpc("finish_tryon", { p_job: job, p_error: "GENERATION_FAILED" });
  const refunded = await a.client
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  check(
    refunded.data.available === 3 && refunded.data.reserved === 0,
    "hosted failure refunds exactly once",
  );
  const deleted = await invoke(a.client, { action: "delete", id: job });
  check(
    deleted.deleted === true,
    "owner can delete a terminal job and its source photos",
  );
  const remaining = await a.client.from("private_assets").select("id");
  check(
    !remaining.error && remaining.data.length === 0,
    "private photo metadata is removed after deletion",
  );
  console.log(
    "Hosted integration checks passed: " +
      passed +
      ". No AI requests or emails were sent.",
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (admin) {
      if (paths.length)
        await admin.storage
          .from("tryon-private")
          .remove(paths)
          .catch(() => {});
      for (const id of users) {
        const deleted = await admin.auth.admin.deleteUser(id);
        if (deleted.error) {
          console.error("Temporary account cleanup needs attention.");
          process.exitCode = 1;
        }
      }
    }
    console.log("Temporary integration accounts cleaned up.");
  });
