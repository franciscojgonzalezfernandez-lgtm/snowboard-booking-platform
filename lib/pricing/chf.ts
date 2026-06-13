// CHF franc ↔ integer-cents conversion. The admin pricing editor (F-080) lets
// the owner type prices in francs (display), but money is always stored and
// validated as integer cents server-side (CLAUDE.md: money never as float).
// These helpers are the single conversion boundary; rounding happens here so a
// stray sub-cent franc value can never reach the store unrounded.

/** CHF francs (decimal) → integer cents, rounded to the nearest cent. */
export function francsToCents(francs: number): number {
  if (!Number.isFinite(francs)) {
    throw new Error(`francsToCents expects a finite number, received ${francs}`);
  }
  return Math.round(francs * 100);
}

/** Integer cents → CHF francs as a number with cent precision (for form defaults). */
export function centsToFrancs(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToFrancs expects integer cents, received ${cents}`);
  }
  return cents / 100;
}
