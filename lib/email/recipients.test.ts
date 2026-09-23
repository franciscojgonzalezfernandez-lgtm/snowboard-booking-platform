import { describe, expect, test } from "vitest";

import { dedupeEmails } from "./recipients";

describe("dedupeEmails", () => {
  test("keeps distinct addresses in first-seen order", () => {
    expect(dedupeEmails(["a@x.io", "b@x.io"])).toEqual(["a@x.io", "b@x.io"]);
  });

  test("collapses case-insensitive duplicates to the first-seen casing", () => {
    expect(dedupeEmails(["Owner@X.io", "owner@x.io"])).toEqual(["Owner@X.io"]);
  });

  test("trims and drops blank / nullish entries", () => {
    expect(dedupeEmails([" a@x.io ", "", null, undefined, "  "])).toEqual([
      "a@x.io",
    ]);
  });

  test("returns an empty array when nothing is left", () => {
    expect(dedupeEmails([null, "  ", undefined])).toEqual([]);
  });
});
