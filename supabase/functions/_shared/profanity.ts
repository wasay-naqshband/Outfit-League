// Objectionable-content filter for public comments and names (App Store 1.2).
// ponytail: a short word list with leetspeak folding; reports and blocking
// catch what it misses. Swap for a moderation API if abuse gets creative.
const WORDS = [
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "slut",
  "whore",
  "asshole",
  "retard",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "tranny",
  "chink",
  "spic",
  "kike",
  "paki",
  "wetback",
  "rape",
  "rapist",
  "kys",
  "porn",
  "nude",
  "nudes",
];
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    // "shiiit", "fuuuck": repeats collapse on both sides of the match.
    .replace(/(\p{L})\1+/gu, "$1");
const PATTERN = new RegExp(
  `(^|[^a-z])(${WORDS.map(fold).join("|")})s?([^a-z]|$)`,
);
// "kill yourself" style phrases, spaced or not.
const PHRASES = /kil\s*(your\s*self|urself)|go\s*die\b/;

export const objectionable = (text: string) => {
  const t = fold(text);
  return PATTERN.test(t) || PHRASES.test(t);
};
