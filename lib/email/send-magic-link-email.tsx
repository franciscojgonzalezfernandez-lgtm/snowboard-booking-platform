import React from "react";
import { MagicLinkEmail, MAGIC_LINK_EMAIL_SUBJECT } from "./templates/magic-link-email";
import { sendEmail, type EmailClient } from "./send-email";

export type SendMagicLinkEmailInput = {
  email: string;
  url: string;
};

export async function sendMagicLinkEmail(
  input: SendMagicLinkEmailInput,
  opts: { client?: EmailClient; env?: NodeJS.ProcessEnv } = {},
) {
  return sendEmail(
    {
      to: input.email,
      subject: MAGIC_LINK_EMAIL_SUBJECT,
      react: <MagicLinkEmail url={input.url} />,
      text: [
        "Use this secure link to finish signing in to Ride Flumserberg.",
        input.url,
      ].join("\n\n"),
      tags: [{ name: "kind", value: "magic-link" }],
    },
    opts,
  );
}
