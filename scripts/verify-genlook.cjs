const fs = require("node:fs");
const config = Object.fromEntries(
  fs
    .readFileSync("supabase/.env.server", "utf8")
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() && !line.trim().startsWith("#") && line.includes("="),
    )
    .map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i).trim(),
        line
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
(async () => {
  if (!config.GENLOOK_API_KEY?.startsWith("gk_")) throw new Error();
  const response = await fetch(
    "https://api.genlook.app/tryon/v1/account/credits",
    {
      headers: { "x-api-key": config.GENLOOK_API_KEY },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json().catch(() => ({}));
  const balance = Number.isInteger(data.creditBalance)
    ? data.creditBalance
    : null;
  console.log(
    JSON.stringify({
      status: response.status,
      authenticated: response.ok,
      creditBalance: balance,
      generationRequested: false,
    }),
  );
  if (!response.ok || balance === null) process.exitCode = 1;
})().catch(() => {
  console.error(
    "Genlook verification could not complete. No credentials or upstream diagnostics were logged.",
  );
  process.exitCode = 1;
});
