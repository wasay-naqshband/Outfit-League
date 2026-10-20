const fs = require("node:fs");
const file = "supabase/.env.server",
  text = fs.readFileSync(file, "utf8");
const line = text
  .split(/\r?\n/)
  .find((row) => row.startsWith("ALLOWED_ORIGINS="));
if (!line) throw new Error("Existing origin configuration is required.");
const origins = new Set(
  line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(",")
    .filter(Boolean),
);
for (const origin of [
  "https://chutni.store",
  "https://www.chutni.store",
  "https://willowy-bienenstitch-cd3e0f.netlify.app",
])
  origins.add(origin);
fs.writeFileSync(
  file,
  text.replace(line, "ALLOWED_ORIGINS=" + [...origins].join(",")),
);
console.log(
  "Production origins added while preserving local origins and private server settings.",
);
