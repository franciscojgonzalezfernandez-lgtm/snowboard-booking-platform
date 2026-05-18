import React from "react";
import { getEmailConfig } from "./config";
import { sendEmail, type EmailClient } from "./send-email";
import { TestEmail, TEST_EMAIL_SUBJECT } from "./templates/test-email";

const DOMAIN = "rideflumserberg.ch";

export async function sendTestEmail(
  opts: {
    to?: string;
    client?: EmailClient;
    env?: NodeJS.ProcessEnv;
  } = {},
) {
  const env = opts.env ?? process.env;
  const config = getEmailConfig(env);
  const to = opts.to ?? config.testRecipient;

  if (!to) {
    throw new Error("EMAIL_TEST_RECIPIENT or an explicit recipient is required");
  }

  return sendEmail(
    {
      to,
      subject: TEST_EMAIL_SUBJECT,
      react: <TestEmail domain={DOMAIN} />,
      text: `Resend is wired for Ride Flumserberg using ${DOMAIN}.`,
      tags: [
        { name: "feature", value: "ops" },
        { name: "kind", value: "resend-test" },
      ],
    },
    { client: opts.client, env },
  );
}
