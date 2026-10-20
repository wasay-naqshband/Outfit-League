const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT || 8083);
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Export the web app first: pnpm export:web");
  process.exit(1);
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".css": "text/css",
};
http
  .createServer((req, res) => {
    let file;
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      file = path.resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
    } catch {
      res.writeHead(400);
      return res.end("Bad request");
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(file)) {
        res.writeHead(404);
        return res.end("Not found");
      }
      file = path.join(root, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log("Outfit League preview: http://localhost:" + port),
  );
