import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStyled } from "../supabase/functions/_shared/stylist.ts";

test("styled outfits keep only bounded, known pieces", () => {
  const id = "4f9c2b1e-1111-4222-8333-944455556666";
  const styled = cleanStyled({
    title: "Summer fit",
    request: "A relaxed weekend",
    pieces: [
      { part: "top", name: "White linen shirt", query: "men white linen shirt", closetId: id },
      { part: "hat?", name: "Straw hat", query: "straw bucket hat", closetId: "drop table" },
      { part: "shoes", name: "", query: "sneakers" },
      "junk",
    ],
  });
  assert.deepEqual(styled, {
    title: "Summer fit",
    request: "A relaxed weekend",
    pieces: [
      { part: "top", name: "White linen shirt", query: "men white linen shirt", closetId: id },
      { part: "accessory", name: "Straw hat", query: "straw bucket hat", closetId: null },
    ],
  });
  assert.equal(cleanStyled({ pieces: [] }), null);
  assert.equal(cleanStyled(null), null);
});
