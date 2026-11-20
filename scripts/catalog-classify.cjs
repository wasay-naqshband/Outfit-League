// Shared catalog rules for Explore: what counts as wearable, what garment
// it is, and which style it belongs to. Used by the Shopify seed script and by
// scripts/reclassify-catalog.cjs, so new imports and old rows follow one rule.

// Not something you wear: prints, home goods, stationery, toys, gift items.
const NON_WEARABLE =
  /\b(art ?prints?|prints? by|posters?|canvas prints?|framed|wall (art|hanging)|stickers?|decals?|candles?|mugs?|tumblers?|water bottles?|books?|zines?|magazines?|throw blankets?|towels?|rugs?|pillows?|cushions?|skate ?board|puzzles?|toys?|plush|vinyl|ornaments?|key ?(chain|ring)s?|lighters?|ash ?trays?|gift ?(cards?|sets?|boxes?)|e-?gift|home ?(decor|goods)|decor|fragrance|perfume|cologne|candle|incense|stationery|notebooks?|journals?|yoga mats?|sample|swatch|bundle|mask|jewel(ry|lery)|rings?|necklaces?|earrings?|bracelets?|watch(es)?|phone case|lanyard|underwear|briefs?|boxers?|bras?|socks?)\b/i;

// Garment type by head noun. In a title the garment is usually the last word
// ("Raw Denim Jacket" is a jacket, "Low Top Sneaker" is a shoe), so we take the
// rule whose match sits furthest right in the text.
const KINDS = [
  [
    "Shoes",
    /\b(sneakers?|shoes?|boots?|loafers?|slides?|sandals?|trainers?|clogs?|mules?|heels?|pumps?|flats?|slippers?|footwear|runners?|oxfords? shoes?|old skool|air max|air force|dunks?|moccasins?)\b/i,
  ],
  [
    "Swimwear",
    /\b(swim(suit|wear|\s?trunks?)?|bikinis?|boardshorts?|bathing suits?|one[- ]piece swim|rash ?guard)\b/i,
  ],
  [
    "Dresses",
    /\b(dress(es)?|gowns?|jumpsuits?|rompers?|playsuits?|overalls?|maxi|midi dress)\b/i,
  ],
  ["Skirts", /\b(skirts?|skorts?)\b/i],
  ["Shorts", /\b(shorts?)\b/i],
  ["Denim", /\b(jeans?)\b/i],
  [
    "Jackets",
    /\b(jackets?|coats?|bombers?|puffers?|gilets?|vests?|blazers?|parkas?|windbreakers?|anoraks?|outerwear|suiting|trenches?|blousons?|cape|poncho|\\w*coats?)\b/i,
  ],
  [
    "Hoodies",
    /\b(hoodies?|hooded|sweatshirts?|crew ?necks?|zip[- ]?ups?|pullovers?|fleece)\b/i,
  ],
  [
    "Knitwear",
    /\b(sweaters?|cardigans?|knit(wear|s)?|turtle ?necks?|jumpers?|cashmere (crew|v-neck)|mock ?necks?)\b/i,
  ],
  [
    "Shirts",
    /\b(shirts?|overshirts?|shackets?|polos?|wovens?|blouses?|oxfords?|button[- ]?(up|down)|kurta|kameez|henley|flannel)\b/i,
  ],
  [
    "Tops",
    /\b(tees?|t-?shirts?|tops?|tanks?|camis?|bodysuits?|corsets?|bustiers?|v-?necks?|tube|crop|singlets?|long ?sleeves?|bralettes?)\b/i,
  ],
  [
    "Bottoms",
    /\b(pants?|trousers?|cargos?|joggers?|leggings?|chinos?|sweatpants?|track ?pants?|slacks?|culottes?|capris?|bottoms?)\b/i,
  ],
  [
    "Accessories",
    /\b(caps?|hats?|beanies?|bags?|totes?|backpacks?|snapbacks?|fitted|9forty|a-frame|scarf|scarves|belts?|sunglass(es)?|gloves?|wallets?|bucket|visors?|headbands?|balaclavas?|bandanas?|duffel|crossbody|fanny|sling|handbags?|clutch|hair)\b/i,
  ],
];

// Words that look like a kind but are not the garment: "Cap Sleeve Top",
// "Mt Hood", "Top Stitch", "Tank Top" (still a top), "Dress Shirt" (a shirt).
function scrub(text) {
  return String(text)
    .replace(/\bbaby ?(tee|doll|t-?shirt|rib|tank)s?\b/gi, "tee")
    .replace(/\bcap[- ]sleeves?\b/gi, " ")
    .replace(/\bdress (shirt|pants?|trousers?|shoes?|socks?)\b/gi, "$1")
    .replace(/\b(low|mid|high)[- ]top\b/gi, " ")
    .replace(/\b(top|bottom)[- ]?(stitch(ed)?|coat)\b/gi, " ")
    .replace(/\bhair ?(brush|clip)s?\b/gi, "hairclip")
    .replace(/\bsleeve(s|less)?\b/gi, " ");
}

function lastKind(text) {
  // Swimwear is a set-level property: a "Bikini Top" is not a top.
  if (
    /\b(bikinis?|swim(suit|wear|\s?trunks?)?|boardshorts?|bathing suits?|rash ?guard)\b/i.test(
      text,
    )
  )
    return "Swimwear";
  // Drop the colourway suffix ("... Parka - Top Blue") before looking for a noun.
  const clean = scrub(String(text).split(/\s+[-–|]\s+/)[0]);
  let best = null;
  for (const [kind, re] of KINDS) {
    const global = new RegExp(re.source, "gi");
    let m;
    while ((m = global.exec(clean))) {
      const end = m.index + m[0].length;
      if (!best || end > best.end) best = { kind, end };
    }
  }
  return best?.kind ?? null;
}

// The title's head noun is the most specific; product type is the fallback
// (it is often generic: "outerwear", "accessory").
function classifyKind({ title, productType, tags }) {
  return (
    lastKind(title) ??
    lastKind(productType) ??
    (/\bdenim\b/i.test(`${title} ${productType}`) ? "Denim" : null) ??
    (/\bfootwear\b/i.test(tags) ? "Shoes" : null)
  );
}

function wearable({ title, productType, tags }) {
  const text = `${title} ${productType}`;
  if (NON_WEARABLE.test(scrub(text))) return false;
  // Shopify merchandisers sometimes tag the whole product.
  if (
    /\b(art|poster|print|home|decor|gift card|stationery)\b/i.test(productType)
  )
    return false;
  return true;
}

// Style. Strong words decide on their own. Weak words only count when they
// agree with the brand's identity (or the brand has none: Casual / Minimal).
const STYLES = [
  [
    "Eastern",
    /\b(kurta|kurti|shalwar|kameez|lawn|unstitched|dupatta|waistcoat|khaddar|shawl)\b/i,
    null,
  ],
  [
    "Athleisure",
    /\b(leggings?|track ?(pants?|jacket|suit)|gym|active(wear)?|training|yoga|running|performance|seamless|sports? bra|workout|compression|bike shorts?|athletic|jogger)\b/i,
    /\b(sports?|sweat|tennis|golf)\b/i,
  ],
  [
    "Formal",
    /\b(blazers?|suits?|tuxedo|formal|dress shirt|dress pants?|loafers?|tailored|pleated trousers?|gowns?|slacks|evening|cocktail|wedding|oxford shoes?)\b/i,
    /\b(trousers?|oxfords?|button[- ]?down|wool|silk)\b/i,
  ],
  [
    "Vintage",
    /\b(vintage|retro|varsity|corduroy|distressed|faded|heritage|[6789]0'?s|western|workwear|selvedge|selvage)\b/i,
    /\b(washed|garment[- ]dyed|waffle|chambray|canvas|denim)\b/i,
  ],
  [
    "Y2K",
    /\b(y2k|baby tee|low[- ]rise|butterfly|rhinestones?|metallic|halter|corset|micro|mini (skirt|dress)|bustier|bedazzled|glitter|sequins?|tube top|cargo skirt)\b/i,
    /\b(mini|lace|mesh|crop(ped)?|cami)\b/i,
  ],
  [
    "Streetwear",
    /\b(streetwear|skate|hype|box logo|tech fleece|collab(oration)?|graphic (tee|hood|sweat)|oversized graphic|stussy|supreme)\b/i,
    /\b(graphic|oversized|boxy|baggy|cargo|logo|hoodie|puffer|varsity)\b/i,
  ],
  [
    "Minimal",
    /\b(minimal(ist)?|essentials?|basics?|plain|solid|linen|cashmere|merino|capsule|everyday)\b/i,
    /\b(relaxed|classic|clean|crew|tee|knit)\b/i,
  ],
];
const NEUTRAL_BRAND_STYLES = new Set(["Casual", "Minimal"]);

// Shopify tags are noisy ("active" is a size filter), so only tags that name a
// style outright count; everything else is read from the title and product type.
const TAG_STYLES = [
  ["Streetwear", /\bstreetwear\b/i],
  ["Y2K", /\by2k\b/i],
  ["Vintage", /\bvintage\b/i],
  ["Athleisure", /\b(athleisure|activewear)\b/i],
  ["Formal", /\bformalwear\b/i],
  ["Minimal", /\bminimal(ist)?\b/i],
];

function classifyStyle({ title, productType, tags, brandStyle }) {
  const text = `${title} ${productType}`;
  // An explicit style word beats the brand default.
  const strong = STYLES.find(([, re]) => re.test(text));
  if (strong) return { style: strong[0], explicit: true };
  const tagged = TAG_STYLES.find(([, re]) => re.test(tags));
  if (tagged) return { style: tagged[0], explicit: true };
  const weak = STYLES.find(([, , re]) => re && re.test(text));
  if (weak && (weak[0] === brandStyle || NEUTRAL_BRAND_STYLES.has(brandStyle)))
    return { style: weak[0], explicit: true };
  return { style: brandStyle, explicit: false };
}

module.exports = { wearable, classifyKind, classifyStyle, lastKind, scrub };
