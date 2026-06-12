/**
 * E.164-ish phone rule: optional leading `+`, a non-zero first digit, and 8–15
 * digits in total. Single source for the booking funnel (F-041 form check,
 * F-042 server action) and the dashboard phone edit (F-064b) so every surface
 * accepts the same shape.
 */
export const E164 = /^\+?[1-9]\d{7,14}$/;
