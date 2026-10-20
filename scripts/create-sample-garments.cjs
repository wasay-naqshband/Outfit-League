// Original code-drawn garment illustrations, intentionally not retail photos.
const fs = require("node:fs");
const sharp = require(process.env.SHARP_MODULE || "sharp");
const colors = {
  navy: "#28364f",
  cream: "#e7d9bb",
  rust: "#b85f39",
  green: "#347957",
  ivory: "#eee9db",
};
(async () => {
  fs.mkdirSync("assets/garments", { recursive: true });
  for (const [name, color] of Object.entries(colors)) {
    const jacket = ["navy", "rust", "green"].includes(name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#fff"/>
      <path d="M310 180 L245 200 L130 360 L205 415 L260 340 L260 630 Q400 650 540 630 L540 340 L595 415 L670 360 L555 200 L490 180 Q400 235 310 180Z" fill="${color}" stroke="#14121f" stroke-width="7" stroke-linejoin="round"/>
      <path d="M310 180 Q400 285 490 180 L465 165 Q400 215 335 165Z" fill="${jacket ? "#d9d0bd" : "#ccc1aa"}" stroke="#14121f" stroke-width="5"/>
      ${jacket ? '<path d="M400 225 V635 M280 600 H520 M290 450 L350 430 M450 430 L510 450" fill="none" stroke="#ded7c6" stroke-width="9"/><path d="M400 260 V590" stroke="#14121f" stroke-width="3"/>' : '<path d="M275 610 Q400 625 525 610" fill="none" stroke="#b6ab97" stroke-width="4"/>'}
      <path d="M180 390 L205 407 M595 407 L620 390" stroke="#14121f" stroke-width="8"/>
      <text x="400" y="735" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#6b6675">OUTFIT LEAGUE · SAMPLE ILLUSTRATION</text>
    </svg>`;
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(`assets/garments/${name}.jpg`);
  }
})();
