/**
 * Shared discriminated-union shape for server-action cores and Server Actions
 * (F-086e). Adopted as a *type alias only*: results are constructed inline
 * (`{ ok: true, ... }` / `{ ok: false, error }`) everywhere in this codebase,
 * so there are deliberately no ok()/err() constructor helpers — two
 * construction styles would be worse than none.
 *
 * Use it where the shape matches exactly. Richer unions with extra
 * discriminants (e.g. the email senders' `{ ok: true; sent: false; reason }`
 * or draft results carrying `issues?: ZodIssue[]`) intentionally stay
 * hand-rolled — do not force them into this alias.
 */
export type Result<TOk extends object, TErr extends string> =
  | ({ ok: true } & TOk)
  | { ok: false; error: TErr };

/** Payload for an ok-arm with no extra fields: `Result<Empty, E>`. */
export type Empty = Record<never, never>;
