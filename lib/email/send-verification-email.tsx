import "server-only";

import React from "react";
import {
  VerificationEmail,
  getVerificationCopy,
} from "./templates/verification-email";
import { sendEmail, type EmailClient } from "./send-email";
import type { Locale } from "@prisma/client";

export type SendVerificationEmailInput = {
  email: string;
  url: string;
  locale?: Locale;
};

// F-122: mirrors sendMagicLinkEmail. Wired into Better Auth's
// `emailVerification.sendVerificationEmail`, which fires on password sign-up and
// on an unverified password sign-in attempt (`sendOnSignIn`). Google and magic
// link never reach it — both provide a pre-verified email.
export async function sendVerificationEmail(
  input: SendVerificationEmailInput,
  opts: { client?: EmailClient; env?: NodeJS.ProcessEnv } = {},
) {
  const locale: Locale = input.locale ?? "en";
  const t = getVerificationCopy(locale);

  return sendEmail(
    {
      to: input.email,
      subject: t.subject,
      react: <VerificationEmail url={input.url} locale={locale} />,
      text: [t.plainIntro, input.url, t.plainOutro, t.signoff].join("\n\n"),
      tags: [
        { name: "feature", value: "auth" },
        { name: "kind", value: "email-verification" },
        { name: "locale", value: locale },
      ],
    },
    opts,
  );
}
