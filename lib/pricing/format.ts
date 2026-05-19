const FORMATTER = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

export function formatChf(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new Error(`formatChf expects integer cents, received ${cents}`);
  }
  return FORMATTER.format(cents / 100);
}
