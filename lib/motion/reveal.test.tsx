import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { useReducedMotion } from "motion/react";

import { Reveal } from "./reveal";

// Keep real motion components; only the reduced-motion hook is controlled.
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: vi.fn() };
});

const mockReducedMotion = vi.mocked(useReducedMotion);

describe("Reveal", () => {
  test("renders a finished, static element under prefers-reduced-motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const html = renderToStaticMarkup(<Reveal>visible</Reveal>);
    expect(html).toContain("visible");
    // No entrance animation → the element is not hidden at rest.
    expect(html).not.toContain("opacity:0");
  });

  test("applies a hidden entrance state when motion is allowed", () => {
    mockReducedMotion.mockReturnValue(false);
    const html = renderToStaticMarkup(<Reveal>visible</Reveal>);
    expect(html).toContain("visible");
    expect(html).toContain("opacity:0");
  });
});
