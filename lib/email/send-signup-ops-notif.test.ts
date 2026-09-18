import { describe, expect, test, vi } from "vitest";

import { sendEmail, type EmailClient } from "./send-email";
import {
  resolveSignupMethod,
  sendSignupOpsNotifWith,
  type SendSignupOpsNotifDeps,
  type SignupOpsNotifInput,
} from "./send-signup-ops-notif";

const OPS_EMAIL = "franciscojgonzalezfernandez@gmail.com";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Ride <booking@rideflumserberg.ch>",
};

function makeInput(
  overrides: Partial<SignupOpsNotifInput> = {},
): SignupOpsNotifInput {
  return {
    id: "user_1",
    email: "new.rider@example.test",
    name: "New Rider",
    locale: "de",
    method: "google",
    ...overrides,
  };
}

function makeDeps(overrides: { count?: number } = {}) {
  const count = vi.fn(async () => overrides.count ?? 42);
  const client: EmailClient = {
    emails: {
      send: vi.fn<EmailClient["emails"]["send"]>(async () => ({
        data: { id: "email_signup_123" },
        error: null,
        headers: null,
      })),
    },
  };

  const deps: SendSignupOpsNotifDeps = {
    prisma: {
      user: { count },
    } as unknown as SendSignupOpsNotifDeps["prisma"],
    send: (input, opts) => sendEmail(input, { ...opts, env: baseEnv }),
    emailClient: client,
  };
  return { deps, client, spies: { count } };
}

function firstCall(client: EmailClient): [Record<string, unknown>, unknown] {
  return (
    client.emails.send as unknown as {
      mock: { calls: Array<[Record<string, unknown>, unknown]> };
    }
  ).mock.calls[0]!;
}

describe("sendSignupOpsNotifWith", () => {
  test("sends one email to the ops inbox with the running total", async () => {
    const { deps, client } = makeDeps({ count: 42 });
    const result = await sendSignupOpsNotifWith(deps, makeInput());

    expect(result).toEqual({
      ok: true,
      emailId: "email_signup_123",
      recipient: OPS_EMAIL,
      total: 42,
    });
    expect(client.emails.send).toHaveBeenCalledTimes(1);

    const [payload, opts] = firstCall(client);
    expect(payload.to).toEqual([OPS_EMAIL]);
    expect(payload.subject as string).toBe(
      "New signup #42 — new.rider@example.test",
    );
    expect((opts as { idempotencyKey?: string }).idempotencyKey).toBe(
      "signup-ops-notif-user_1",
    );
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        { name: "feature", value: "auth" },
        { name: "kind", value: "signup-ops-notif" },
        { name: "locale", value: "en" },
      ]),
    );
  });

  test("plaintext carries email, name, method label, locale and total", async () => {
    const { deps, client } = makeDeps({ count: 7 });
    await sendSignupOpsNotifWith(deps, makeInput({ method: "email-password" }));
    const [payload] = firstCall(client);
    const text = payload.text as string;
    expect(text).toContain("Email: new.rider@example.test");
    expect(text).toContain("Name: New Rider");
    expect(text).toContain("Signup method: Email + password");
    expect(text).toContain("Language: DE");
    expect(text).toContain("Total accounts: 7");
  });

  test("shows an em dash for a blank name (e.g. magic-link signup)", async () => {
    const { deps, client } = makeDeps();
    await sendSignupOpsNotifWith(
      deps,
      makeInput({ name: "   ", method: "magic-link" }),
    );
    const [payload] = firstCall(client);
    expect(payload.text as string).toContain("Name: —");
    expect(payload.text as string).toContain("Signup method: Magic link");
  });

  test("respects an ops recipient override", async () => {
    const { deps, client } = makeDeps();
    deps.opsEmail = "someone-else@example.test";
    const result = await sendSignupOpsNotifWith(deps, makeInput());
    expect(result.recipient).toBe("someone-else@example.test");
    const [payload] = firstCall(client);
    expect(payload.to).toEqual(["someone-else@example.test"]);
  });
});

describe("resolveSignupMethod", () => {
  test.each([
    ["/magic-link/verify", "magic-link"],
    ["/sign-in/magic-link", "magic-link"],
    ["/callback/google", "google"],
    ["/oauth2/callback/google", "google"],
    ["/sign-up/email", "email-password"],
    ["/sign-in/email", "email-password"],
  ])("maps %s → %s", (path, expected) => {
    expect(resolveSignupMethod({ path })).toBe(expected);
  });

  test("falls back to 'other' for an unknown or missing path", () => {
    expect(resolveSignupMethod({ path: "/whatever" })).toBe("other");
    expect(resolveSignupMethod(null)).toBe("other");
    expect(resolveSignupMethod(undefined)).toBe("other");
    expect(resolveSignupMethod({})).toBe("other");
  });
});
