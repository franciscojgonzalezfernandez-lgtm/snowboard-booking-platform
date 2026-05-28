import { describe, expect, test } from "vitest";

import { userPhoneSchema } from "./user-phone";

describe("userPhoneSchema (F-064b)", () => {
  test("accepts a valid E.164 number", () => {
    const r = userPhoneSchema.safeParse("+41761112233");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("+41761112233");
  });

  test("strips spaces before validating", () => {
    const r = userPhoneSchema.safeParse("+41 76 111 22 33");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("+41761112233");
  });

  test("rejects a malformed number", () => {
    expect(userPhoneSchema.safeParse("not-a-phone").success).toBe(false);
  });

  test("maps the empty string to null (phone removed)", () => {
    const r = userPhoneSchema.safeParse("");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeNull();
  });

  test("rejects a lone plus sign", () => {
    expect(userPhoneSchema.safeParse("+").success).toBe(false);
  });
});
