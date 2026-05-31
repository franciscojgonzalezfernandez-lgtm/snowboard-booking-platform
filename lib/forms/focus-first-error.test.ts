import { describe, expect, test, vi } from "vitest";
import type { FieldErrors, Path, UseFormSetFocus } from "react-hook-form";

import { focusFirstError } from "./focus-first-error";

type Form = {
  name: string;
  phone: string;
  age: number;
  acceptedTerms: true;
};

function makeSetFocus(): UseFormSetFocus<Form> {
  return vi.fn() as unknown as UseFormSetFocus<Form>;
}

describe("focusFirstError", () => {
  test("focuses the first invalid field in visual order, not the first key on the errors object", async () => {
    const setFocus = makeSetFocus();
    const errors = {
      acceptedTerms: { type: "literal", message: "required" },
      phone: { type: "pattern", message: "INVALID_PHONE" },
    } as unknown as FieldErrors<Form>;
    const order: Path<Form>[] = ["name", "phone", "age", "acceptedTerms"];

    const focused = focusFirstError(errors, setFocus, order);

    expect(focused).toBe("phone");
    expect(setFocus).toHaveBeenCalledWith("phone");
  });

  test("returns null + does not call setFocus when no listed field is invalid", () => {
    const setFocus = makeSetFocus();
    const errors = {} as FieldErrors<Form>;
    const focused = focusFirstError(errors, setFocus, [
      "name",
      "phone",
    ]);
    expect(focused).toBeNull();
    expect(setFocus).not.toHaveBeenCalled();
  });

  test("respects dotted paths for nested array fields", () => {
    const setFocus = makeSetFocus();
    const errors = {
      attendees: [
        undefined,
        { name: { type: "min", message: "REQUIRED" } },
      ],
    } as unknown as FieldErrors<Form>;
    const order: Path<Form>[] = [
      "name",
      "attendees.1.name" as Path<Form>,
    ];
    const focused = focusFirstError(errors, setFocus, order);
    expect(focused).toBe("attendees.1.name");
    expect(setFocus).toHaveBeenCalledWith("attendees.1.name");
  });
});
