const fs = require("node:fs");
const values = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter(
      (line) => line && !line.trimStart().startsWith("#") && line.includes("="),
    )
    .map((line) => {
      const position = line.indexOf("=");
      return [
        line.slice(0, position).trim(),
        line
          .slice(position + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
const url = values.EXPO_PUBLIC_SUPABASE_URL;
const key =
  values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  values.EXPO_PUBLIC_SUPABASE_ANON_KEY;
(async () => {
  if (!url || !key) {
    console.log(
      JSON.stringify({
        configured: false,
        urlPresent: !!url,
        keyPresent: !!key,
      }),
    );
    process.exitCode = 1;
    return;
  }
  const base = new URL(url);
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("Use your HTTPS project URL without credentials.");
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "A secret key was entered. Replace it with the public publishable key.",
    );
  if (key.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      if (claims.role === "service_role") throw new Error("SERVICE_ROLE_KEY");
    } catch (error) {
      if (error.message === "SERVICE_ROLE_KEY")
        throw new Error(
          "A service-role key was entered. Replace it with a public anon/publishable key.",
        );
    }
  }
  const auth = await fetch(base.origin + "/auth/v1/settings", {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  const settings = await auth.json().catch(() => ({}));
  const tables = await fetch(
    base.origin + "/rest/v1/credit_wallets?select=available&limit=1",
    { headers: { apikey: key }, signal: AbortSignal.timeout(15000) },
  );
  const functions = await fetch(base.origin + "/functions/v1/tryon", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "config" }),
    signal: AbortSignal.timeout(15000),
  });
  console.log(
    JSON.stringify(
      {
        configured: true,
        projectHost: base.hostname,
        authStatus: auth.status,
        publicKeyAccepted: auth.ok,
        emailAuthEnabled: settings.external?.email ?? null,
        emailConfirmationRequired: settings.mailer_autoconfirm === false,
        walletEndpointStatus: tables.status,
        tryOnEndpointStatus: functions.status,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
