import { describe, expect, it, vi } from "vitest";
import type { CreateEmailOptions } from "resend";
import { EmailSendError, sendEmail, type EmailClient } from "./send-email";

function mockClient(
  response: Awaited<ReturnType<EmailClient["emails"]["send"]>>,
) {
  return {
    emails: {
      send: vi.fn<EmailClient["emails"]["send"]>(async () => response),
    },
  } satisfies EmailClient;
}

describe("sendEmail", () => {
  it("sends through Resend with configured sender", async () => {
    const client = mockClient({
      data: { id: "email_123" },
      error: null,
      headers: null,
    });

    const result = await sendEmail(
      {
        to: "student@example.com",
        subject: "Test",
        react: <div>Test</div>,
        text: "Test",
      },
      {
        client,
        env: {
          NODE_ENV: "test",
          RESEND_API_KEY: "re_test",
          EMAIL_FROM: "Ride <hello@rideflumserberg.ch>",
        },
      },
    );

    expect(result).toEqual({ id: "email_123" });
    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining<CreateEmailOptions>({
        from: "Ride <hello@rideflumserberg.ch>",
        to: "student@example.com",
        subject: "Test",
        text: "Test",
      }),
      undefined,
    );
  });

  it("uses a development console fallback when no API key is configured", async () => {
    const client = mockClient({
      data: { id: "email_123" },
      error: null,
      headers: null,
    });

    await expect(
      sendEmail(
        {
          to: "student@example.com",
          subject: "Test",
          react: <div>Test</div>,
          text: "Test",
        },
        { client, env: { NODE_ENV: "development" } },
      ),
    ).resolves.toEqual({ id: "dev-email-disabled" });

    expect(client.emails.send).not.toHaveBeenCalled();
  });

  it("throws Resend error messages", async () => {
    const client = mockClient({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid sender",
        statusCode: 422,
      },
      headers: null,
    });

    await expect(
      sendEmail(
        {
          to: "student@example.com",
          subject: "Test",
          react: <div>Test</div>,
          text: "Test",
        },
        {
          client,
          env: {
            NODE_ENV: "production",
            RESEND_API_KEY: "re_test",
          },
        },
      ),
    ).rejects.toThrow(new EmailSendError("Invalid sender"));
  });
});
