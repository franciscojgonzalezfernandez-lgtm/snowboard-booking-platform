"use client";

import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormSetFocus,
} from "react-hook-form";

/**
 * F-073: shared `onInvalid` helper. Walks `order` in declaration order and
 * focuses the first field that errored. Returns the field key it focused (or
 * null) so callers can decide whether to surface a top-of-form banner.
 *
 * Extracted from the per-form copies introduced by:
 *   - PR #100 (Step 4 booker form)
 *   - PR #102 (F-072 availability create form)
 *   - PR #103 (F-073 profile edit form)
 *
 * Three call sites is the threshold — copy-pasting a fourth would have been a
 * miss. Each form passes a static array of field paths in visual order; the
 * helper handles the "which one to focus first" walk.
 */
export function focusFirstError<T extends FieldValues>(
  errors: FieldErrors<T>,
  setFocus: UseFormSetFocus<T>,
  order: Path<T>[],
): Path<T> | null {
  for (const key of order) {
    // RHF nests array-field errors under the root key (e.g. `attendees`); we
    // treat any presence on the root as "this group has an error, focus
    // here". Callers that need to focus a specific sub-field of an array
    // should put the dotted path in `order` themselves.
    const segments = (key as string).split(".");
    let cursor: unknown = errors as unknown;
    let found = true;
    for (const seg of segments) {
      if (
        cursor &&
        typeof cursor === "object" &&
        seg in (cursor as Record<string, unknown>)
      ) {
        cursor = (cursor as Record<string, unknown>)[seg];
      } else {
        found = false;
        break;
      }
    }
    if (found && cursor != null) {
      setFocus(key);
      return key;
    }
  }
  return null;
}
