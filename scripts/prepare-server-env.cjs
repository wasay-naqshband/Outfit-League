const fs = require("node:fs"),
  crypto = require("node:crypto");
const path = "supabase/.env.server";
if (!fs.existsSync(path)) {
  fs.writeFileSync(
    path,
    [
      "# Private server configuration. Never copy these values into the app's .env.",
      "# Add the selected provider key below. Never paste it into chat.",
      "TRYON_PROVIDER=genlook",
      "GENLOOK_API_KEY=",
      "FASHN_API_KEY=",
      "LIVE_TRYON_ENABLED=false",
      "ALLOWED_ORIGINS=http://localhost:8081,http://localhost:8083,http://127.0.0.1:8083",
      "TRYON_WORKER_SECRET=" + crypto.randomBytes(32).toString("hex"),
      "",
    ].join("\n"),
  );
}
console.log(
  "Private server configuration file is ready. No secrets were printed.",
);
