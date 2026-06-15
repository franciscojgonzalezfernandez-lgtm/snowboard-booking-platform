/**
 * Run a DOM update inside a native View Transition when the browser supports
 * it, otherwise apply it directly. Framework-agnostic, no dependency.
 *
 * ponytail: native View Transitions API + plain fallback. Reach for `motion`'s
 * AnimatePresence only if a route ever needs choreography the browser can't do.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(update);
    return;
  }
  update();
}
