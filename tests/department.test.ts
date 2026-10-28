import test from "node:test";
import assert from "node:assert/strict";
import { forDepartment } from "../supabase/functions/_shared/stylist.ts";

test("shop queries name the wearer's department only", () => {
  assert.equal(
    forDepartment("black wide leg pants", "men"),
    "men's black wide leg pants",
  );
  assert.equal(
    forDepartment("women's velvet crop top", "men"),
    "men's velvet crop top",
  );
  assert.equal(
    forDepartment("men's denim jacket", "women"),
    "women's denim jacket",
  );
  assert.equal(forDepartment("women's boots", "women"), "women's boots");
  assert.equal(forDepartment("white sneakers", null), "white sneakers");
});
