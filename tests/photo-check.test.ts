import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhoto, labelGarment, scanItem } from "../supabase/functions/_shared/stylist.ts";
import { objectionable } from "../supabase/functions/_shared/profanity.ts";

const answer = (out: Record<string, unknown>) =>
  (async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }],
    })) as unknown as typeof fetch;
const ok = {
  people: 1,
  faceHidden: false,
  framing: "full_body",
  armSelfie: false,
  clear: true,
};
const uri = "data:image/jpeg;base64,AAAA";

test("photo check: lenient on good photos, specific on bad ones", async () => {
  const check = (o: Record<string, unknown>) =>
    checkPhoto("k", uri, answer({ ...ok, ...o }));
  assert.equal(await check({}), null);
  assert.equal(await check({ framing: "knees_up" }), null);
  assert.equal(await check({ framing: "full_body", armSelfie: true }), null);
  assert.equal(await check({ people: 0 }), "PHOTO_NO_PERSON");
  assert.equal(await check({ people: 3 }), "PHOTO_GROUP");
  assert.equal(await check({ faceHidden: true }), "PHOTO_SELFIE");
  assert.equal(
    await check({ framing: "waist_up", armSelfie: true }),
    "PHOTO_SELFIE",
  );
  assert.equal(await check({ framing: "head_only" }), "PHOTO_CLOSE_UP");
  assert.equal(await check({ clear: false }), "PHOTO_UNCLEAR");
});

test("comment filter catches slurs and disguises, not everyday words", () => {
  for (const bad of [
    "you're a b1tch",
    "F U C K".replace(/ /g, ""),
    "kill urself",
    "SHIIIIT",
    "n1gga",
  ])
    assert.equal(objectionable(bad), true, bad);
  for (const fine of [
    "Go with A!",
    "class outfit",
    "Scunthorpe vibes",
    "cocktail dress",
    "assassin's creed tee",
    "dickies pants",
  ])
    assert.equal(objectionable(fine), false, fine);
});

test("closet labeler: keeps bounded fields and a known category", async () => {
  const label = await labelGarment(
    "k",
    uri,
    answer({ name: "Light blue denim jacket", category: "Coats", color: "light blue", brand: "" }),
  );
  assert.deepEqual(label, {
    name: "Light blue denim jacket",
    category: "Other",
    color: "light blue",
    brand: "",
  });
});

test("scan: clamps the score and keeps only real closet pairs", async () => {
  const scan = await scanItem(
    "k",
    uri,
    { season: "Soft Autumn", best: ["olive"], styles: [] },
    [{ id: "a", name: "Black cargos", category: "Bottoms", color: "black", brand: "", tags: "" }],
    answer({
      name: "Olive bomber jacket",
      category: "Jackets",
      colors: [{ name: "Olive", hex: "#556B2F" }, { name: "Bad", hex: "olive" }],
      details: ["Nylon shell"],
      vibe: "Streetwear",
      vibeLine: "Instant edge.",
      price: "$60–90",
      query: "olive nylon bomber jacket men",
      score: 14,
      verdict: "Olive sits right in your Soft Autumn palette.",
      pairs: ["a", "made-up"],
      idea: "Wear it over a white tee.",
    }),
  );
  assert.equal(scan.score, 10);
  assert.deepEqual(scan.colors, [{ name: "Olive", hex: "#556B2F" }]);
  assert.deepEqual(scan.pairs, [{ id: "a", name: "Black cargos" }]);
  assert.equal(scan.category, "Jackets");
});
