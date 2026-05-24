import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Source-level guard: importing `auth` directly would boot the Prisma client
// (which requires DATABASE_URL) — that's outside the scope of this assertion.
// Reading the file is enough to catch a silent removal of the linking block.
const authSource = readFileSync(
  path.resolve(__dirname, "../lib/auth/index.ts"),
  "utf8",
);

describe("Better Auth config", () => {
  it("enables account linking for Google so existing magic-link users can sign in via OAuth", () => {
    expect(authSource).toMatch(/account\s*:\s*\{[\s\S]*?accountLinking\s*:\s*\{/);
    expect(authSource).toMatch(/enabled\s*:\s*true/);
    expect(authSource).toMatch(/trustedProviders\s*:\s*\[\s*"google"\s*\]/);
  });

  it("does not trust providers that lack mandatory pre-sign-in email verification", () => {
    const trustedBlock = authSource.match(
      /trustedProviders\s*:\s*\[([^\]]*)\]/,
    );
    expect(trustedBlock).not.toBeNull();
    const inside = trustedBlock?.[1] ?? "";
    expect(inside).not.toMatch(/"email-password"/);
    expect(inside).not.toMatch(/"magic-link"/);
  });
});
