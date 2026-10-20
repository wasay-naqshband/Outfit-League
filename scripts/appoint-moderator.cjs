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
// Server operator only. Never appoint from client-supplied metadata.
(async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@"))
    throw Error("Provide one exact existing account email.");
  const admin = createClient(url.origin, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let found = null;
  for (let page = 1; page <= 100; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw Error("Cannot verify existing account.");
    const match = result.data.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (match) {
      found = match;
      break;
    }
    if (result.data.users.length < 1000) break;
  }
  if (!found || !found.email_confirmed_at)
    throw Error("A confirmed existing account is required.");
  const profile = await admin
    .from("profiles")
    .select("deleting_at")
    .eq("id", found.id)
    .single();
  if (profile.error || profile.data.deleting_at)
    throw Error("An active account is required.");
  const appointed = await admin
    .from("moderators")
    .upsert({ owner_id: found.id });
  if (appointed.error) throw Error("Appointment failed.");
  console.log(JSON.stringify({ appointed: true, email }));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
