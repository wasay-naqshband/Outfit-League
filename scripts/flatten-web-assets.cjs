// Static hosts may skip node_modules/dot directories in manually uploaded zips.
// Flatten Expo's hashed web assets and rewrite only their exact bundled URLs.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(process.argv[2] || "dist-hostinger"),
  assetRoot = path.join(root, "assets");
if (!root.startsWith(path.resolve(".") + path.sep) || !fs.existsSync(assetRoot))
  throw new Error("Use a web export inside the workspace.");
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else files.push(file);
  }
}
walk(assetRoot);
const replacements = [];
for (const file of files) {
  const target = path.join(assetRoot, path.basename(file));
  if (file === target) continue;
  const bytes = fs.readFileSync(file);
  if (fs.existsSync(target) && !bytes.equals(fs.readFileSync(target)))
    throw new Error("Asset name collision.");
  fs.writeFileSync(target, bytes);
  replacements.push([
    "/" + path.relative(root, file).split(path.sep).join("/"),
    "/assets/" + path.basename(file),
  ]);
}
const bundles = [];
function scripts(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) scripts(file);
    else if (
      file.endsWith(".js") ||
      file.endsWith(".html") ||
      file.endsWith(".css")
    )
      bundles.push(file);
  }
}
scripts(root);
for (const file of bundles) {
  let text = fs.readFileSync(file, "utf8");
  for (const [before, after] of replacements)
    text = text
      .replaceAll(before, after)
      .replaceAll(encodeURI(before), encodeURI(after));
  fs.writeFileSync(file, text);
}
for (const [before] of replacements) {
  const file = path.resolve(root, "." + before);
  if (!file.startsWith(root + path.sep)) throw new Error("Invalid asset path.");
  fs.unlinkSync(file);
}
console.log("Flattened " + replacements.length + " hashed web assets.");
