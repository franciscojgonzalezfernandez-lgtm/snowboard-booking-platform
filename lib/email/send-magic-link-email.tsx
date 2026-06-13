import "server-only";

import React from "react";
import {
  MagicLinkEmail,
  getMagicLinkCopy,
} from "./templates/magic-link-email";
import { sendEmail, type EmailClient } from "./send-email";
import type { Locale } from "@prisma/client";

export type SendMagicLinkEmailInput = {
  email: string;
  url: string;
  locale?: Locale;
};

export async function sendMagicLinkEmail(
  input: SendMagicLinkEmailInput,
  opts: { client?: EmailClient; env?: NodeJS.ProcessEnv } = {},
) {
  const locale: Locale = input.locale ?? "en";
  const t = getMagicLinkCopy(locale);

  return sendEmail(
    {
      to: input.email,
      subject: t.subject,
      react: <MagicLinkEmail url={input.url} locale={locale} />,
      text: [t.plainIntro, input.url, t.plainOutro, t.signoff].join("\n\n"),
      tags: [
        { name: "feature", value: "auth" },
        { name: "kind", value: "magic-link" },
        { name: "locale", value: locale },
      ],
    },
    opts,
  );
}
