import { describe, expect, it } from "vitest";

import { OPERATIONAL_PHONE_DISPLAY, OPERATIONAL_PHONE_TEL } from "./phone";

describe("operational phone constants", () => {
  it("exposes the owner display number with CH spacing", () => {
    expect(OPERATIONAL_PHONE_DISPLAY).toBe("+41 76 638 18 70");
  });

  it("derives an E.164 tel value with no spaces", () => {
    expect(OPERATIONAL_PHONE_TEL).toBe("+41766381870");
    expect(OPERATIONAL_PHONE_TEL).not.toMatch(/\s/);
  });
});
