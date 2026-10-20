const fs = require("node:fs"),
  path = require("node:path");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(file);
  }
}
walk("dist-hostinger");
const secrets = fs
  .readFileSync("supabase/.env.server", "utf8")
  .split(/\r?\n/)
  .filter((line) => /^[A-Z_]*(KEY|SECRET)=/.test(line))
  .map((line) =>
    line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, ""),
  )
  .filter((value) => value.length > 20);
const buffers = files.map((file) => fs.readFileSync(file));
const audit = {
  candidateDomain: "https://chutni.store",
  files: files.length,
  spaFallbackPresent: files.some((file) => file.endsWith(".htaccess")),
  domainConfigured: buffers.some((bytes) =>
    bytes.includes(Buffer.from("https://chutni.store")),
  ),
  privateServerSecretsAbsent: secrets.every((secret) =>
    buffers.every((bytes) => !bytes.includes(Buffer.from(secret))),
  ),
  noEnvironmentFiles: files.every(
    (file) => !path.basename(file).startsWith(".env"),
  ),
};
fs.mkdirSync("release", { recursive: true });
fs.writeFileSync("release/hosting-audit.json", JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit));
if (
  !audit.spaFallbackPresent ||
  !audit.domainConfigured ||
  !audit.privateServerSecretsAbsent ||
  !audit.noEnvironmentFiles
)
  process.exitCode = 1;
