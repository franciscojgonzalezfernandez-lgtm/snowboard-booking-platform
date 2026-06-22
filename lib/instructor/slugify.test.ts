import { describe, expect, it } from "vitest";

import { slugifyName } from "./slugify";

describe("slugifyName", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugifyName("Sam Booker")).toBe("sam-booker");
  });

  it("folds diacritics", () => {
    expect(slugifyName("Lara Müller")).toBe("lara-muller");
    expect(slugifyName("José Núñez")).toBe("jose-nunez");
  });

  it("collapses punctuation and trims edges", () => {
    expect(slugifyName("  Javi!! ")).toBe("javi");
    expect(slugifyName("Anne-Marie O'Neil")).toBe("anne-marie-o-neil");
  });
});
