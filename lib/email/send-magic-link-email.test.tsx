import { describe, expect, it, vi } from "vitest";
import type { EmailClient } from "./send-email";
import { sendMagicLinkEmail } from "./send-magic-link-email";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Ride <hello@rideflumserberg.ch>",
};

function mockClient(id = "email_magic") {
  return {
    emails: {
      send: vi.fn<EmailClient["emails"]["send"]>(async () => ({
        data: { id },
        error: null,
        headers: null,
      })),
    },
  } satisfies EmailClient;
}

describe("sendMagicLinkEmail", () => {
  it("defaults to English copy and tags the message for auth", async () => {
    const client = mockClient();

    await expect(
      sendMagicLinkEmail(
        {
          email: "student@example.com",
          url: "https://rideflumserberg.ch/api/auth/magic-link/abc",
        },
        { client, env: baseEnv },
      ),
    ).resolves.toEqual({ id: "email_magic" });

    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your Ride Flumserberg sign-in link",
        tags: [
          { name: "feature", value: "auth" },
          { name: "kind", value: "magic-link" },
          { name: "locale", value: "en" },
        ],
        text: expect.stringContaining("rideflumserberg.ch/api/auth/magic-link/abc"),
      }),
      undefined,
    );
  });

  it.each([
    ["de", "Dein Anmelde-Link für Ride Flumserberg"],
    ["es", "Tu enlace de acceso a Ride Flumserberg"],
  ] as const)("translates subject and locale tag for %s", async (locale, subject) => {
    const client = mockClient();

    await sendMagicLinkEmail(
      {
        email: "student@example.com",
        url: "https://rideflumserberg.ch/api/auth/magic-link/abc",
        locale,
      },
      { client, env: baseEnv },
    );

    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject,
        tags: expect.arrayContaining([
          { name: "feature", value: "auth" },
          { name: "locale", value: locale },
        ]),
      }),
      undefined,
    );
  });
});
