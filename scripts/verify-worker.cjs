const fs = require("node:fs");
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
(async () => {
  const response = await fetch(
    new URL(client.EXPO_PUBLIC_SUPABASE_URL).origin + "/functions/v1/tryon",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": server.TRYON_WORKER_SECRET,
      },
      body: JSON.stringify({ action: "reconcile" }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  console.log(
    JSON.stringify({
      workerStatus: response.status,
      reconciled: data.reconciled ?? null,
      error: data.error ?? null,
    }),
  );
  if (!response.ok) process.exitCode = 1;
})().catch(() => {
  console.error("Worker check failed. No secrets were logged.");
  process.exitCode = 1;
});
