const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
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
const server = parse("supabase/.env.server"),
  client = parse(".env");
if (!/^[0-9a-f]{64}$/.test(server.TRYON_WORKER_SECRET ?? ""))
  throw new Error("Prepare the worker secret first.");
const origin = new URL(client.EXPO_PUBLIC_SUPABASE_URL).origin;
const projectHost = new URL(origin).hostname;
if (!/^[a-z]{20}\.supabase\.co$/.test(projectHost))
  throw new Error("Use the verified Supabase project URL for deployment.");
const projectRef = projectHost.split(".")[0];
const sqlQuote = (value) => "'" + value.replaceAll("'", "''") + "'";
const sql = [
  "create extension if not exists pg_cron;",
  "create extension if not exists pg_net with schema extensions;",
  "do $worker_setup$ declare secret_id uuid; begin",
  "select id into secret_id from vault.secrets where name='tryon_worker_secret';",
  "if secret_id is null then perform vault.create_secret(" +
    sqlQuote(server.TRYON_WORKER_SECRET) +
    ",'tryon_worker_secret');",
  "else perform vault.update_secret(secret_id," +
    sqlQuote(server.TRYON_WORKER_SECRET) +
    "); end if;",
  "select id into secret_id from vault.secrets where name='tryon_function_url';",
  "if secret_id is null then perform vault.create_secret(" +
    sqlQuote(origin + "/functions/v1/tryon") +
    ",'tryon_function_url');",
  "else perform vault.update_secret(secret_id," +
    sqlQuote(origin + "/functions/v1/tryon") +
    "); end if; end $worker_setup$;",
  "select cron.schedule('outfit-league-tryon-reconcile','* * * * *',$schedule$",
  "select net.http_post(",
  "url := (select decrypted_secret from vault.decrypted_secrets where name='tryon_function_url'),",
  "headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='tryon_worker_secret')),",
  'body := \'{"action":"reconcile"}\'::jsonb, timeout_milliseconds := 100000);',
  "$schedule$);",
].join("\n");
const packageFile = require.resolve("supabase/package.json"),
  pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const cli = path.resolve(
  path.dirname(packageFile),
  typeof pkg.bin === "string" ? pkg.bin : pkg.bin.supabase,
);
const temp = path.resolve("supabase/.temp/worker-setup.sql");
fs.mkdirSync(path.dirname(temp), { recursive: true });
fs.writeFileSync(temp, sql);
function run(args) {
  const result = cp.spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  let output = (result.stdout ?? "") + (result.stderr ?? "");
  for (const value of Object.values(server))
    if (value && value.length > 10)
      output = output.replaceAll(value, "[redacted]");
  if (result.status !== 0) {
    console.error(output);
    throw new Error("Server setup failed; secrets were redacted.");
  }
}
try {
  run([
    "secrets",
    "set",
    "--project-ref",
    projectRef,
    "--env-file",
    "supabase/.env.server",
  ]);
  run(["db", "query", "--project-ref", projectRef, "--file", temp]);
  console.log(
    "Server secrets and one-minute reconciliation schedule configured. Secret values were not printed.",
  );
} finally {
  fs.rmSync(temp, { force: true });
}
