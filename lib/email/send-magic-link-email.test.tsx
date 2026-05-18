import { describe, expect, it, vi } from "vitest";
import type { EmailClient } from "./send-email";
import { sendMagicLinkEmail } from "./send-magic-link-email";

describe("sendMagicLinkEmail", () => {
  it("sends magic-link copy through the email client", async () => {
    const client = {
      emails: {
        send: vi.fn<EmailClient["emails"]["send"]>(async () => ({
          data: { id: "email_magic" },
          error: null,
          headers: null,
        })),
      },
    } satisfies EmailClient;

    await expect(
      sendMagicLinkEmail(
        {
          email: "student@example.com",
          url: "https://rideflumserberg.ch/api/auth/magic-link/abc",
        },
        {
          client,
          env: {
            NODE_ENV: "test",
            RESEND_API_KEY: "re_test",
            EMAIL_FROM: "Ride <hello@rideflumserberg.ch>",
          },
        },
      ),
    ).resolves.toEqual({ id: "email_magic" });

    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your Ride Flumserberg sign-in link",
        tags: [{ name: "kind", value: "magic-link" }],
        text: expect.stringContaining("rideflumserberg.ch"),
      }),
      undefined,
    );
  });
});
