import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { useReducedMotion } from "motion/react";

import { Reveal } from "./reveal";

// Keep real motion components; only the reduced-motion hook is controlled, so
// we can prove the render output does NOT depend on it.
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: vi.fn() };
});

const mockReducedMotion = vi.mocked(useReducedMotion);

describe("Reveal", () => {
  // Regression guard for the F-106 hydration mismatch: the server has no media
  // query, so the markup must be identical whatever the reduced-motion state.
  // Reduced motion is applied in CSS (globals.css `[data-motion]`), not by
  // branching the rendered element.
  test("markup is identical regardless of prefers-reduced-motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const reduced = renderToStaticMarkup(<Reveal>visible</Reveal>);
    mockReducedMotion.mockReturnValue(false);
    const full = renderToStaticMarkup(<Reveal>visible</Reveal>);
    expect(reduced).toBe(full);
  });

  test("renders the animated entrance state plus the reduced-motion CSS hook", () => {
    const html = renderToStaticMarkup(<Reveal>visible</Reveal>);
    expect(html).toContain("visible");
    // The entrance state ships in the markup for everyone…
    expect(html).toContain("opacity:0");
    // …and the data-motion hook lets the CSS media query pin it visible.
    expect(html).toContain('data-motion="reveal"');
  });
});
