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

// Server operator utility. No moderator credentials are included in the app.
(async () => {
  const admin = createClient(url.origin, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const action = process.argv[2] ?? "list";
  if (action === "hide") {
    const id = process.argv[3];
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id ?? "",
      )
    )
      throw new Error("Provide one exact battle UUID.");
    const result = await admin
      .from("battles")
      .update({ status: "hidden" })
      .eq("id", id)
      .in("status", ["published", "closed"])
      .select("id,status")
      .single();
    if (result.error)
      throw new Error("Battle could not be hidden; verify its current status.");
    console.log(JSON.stringify(result.data));
    return;
  }
  if (action !== "list")
    throw new Error(
      "Usage: node scripts/moderate-battles.cjs list | hide BATTLE_UUID",
    );
  const reports = await admin
    .from("battle_reports")
    .select("battle_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reports.error) throw new Error("Report queue could not load.");
  const ids = [...new Set(reports.data.map((item) => item.battle_id))];
  if (!ids.length) {
    console.log("No reports in the review queue.");
    return;
  }
  const battles = await admin
    .from("battles")
    .select("id,title,status")
    .in("id", ids);
  if (battles.error) throw new Error("Reported battles could not load.");
  for (const battle of battles.data)
    console.log(
      JSON.stringify({
        ...battle,
        reports: reports.data
          .filter((item) => item.battle_id === battle.id)
          .map((item) => ({
            reason: item.reason,
            created_at: item.created_at,
          })),
      }),
    );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
