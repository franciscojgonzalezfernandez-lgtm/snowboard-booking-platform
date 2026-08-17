import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email/send-magic-link-email";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { getEmailLocaleFromRequest } from "@/lib/email/locale";
import type { Locale } from "@prisma/client";

/**
 * How long a magic link stays usable.
 *
 * F-138: Better Auth falls back to **300 s** when `expiresIn` is omitted, and it
 * was omitted — five minutes to receive an email, notice it, and click it.
 * Measured against production rows: a link requested at 08:04:26 was already
 * dead at 08:09:26. To the booker that reads as "the link is broken", which is
 * indistinguishable from the F-134 failure it happened to follow.
 *
 * 30 minutes covers a slow inbox without turning the link into a long-lived
 * credential: it stays single-use, and the session it opens is governed
 * separately by `session.expiresIn`.
 */
export const MAGIC_LINK_EXPIRY_SECONDS = 60 * 30;

const MAGIC_LINK_DELIVERY_FAILED_MESSAGE: Record<Locale, string> = {
  en: "Could not send the sign-in email. Please try again in a moment.",
  de: "Anmelde-E-Mail konnte nicht gesendet werden. Bitte versuche es gleich erneut.",
  es: "No se pudo enviar el correo de acceso. Inténtalo de nuevo en un momento.",
};

const VERIFICATION_DELIVERY_FAILED_MESSAGE: Record<Locale, string> = {
  en: "Could not send the confirmation email. Please try again in a moment.",
  de: "Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuche es gleich erneut.",
  es: "No se pudo enviar el correo de confirmación. Inténtalo de nuevo en un momento.",
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // F-122: an unverified email+password account must not be able to hold a
    // booking slot. Better Auth now refuses to sign such a user in (403
    // EMAIL_NOT_VERIFIED) until they click the link below, and skips
    // auto-sign-in on sign-up. Google (`email_verified` on the id_token) and
    // magic link (proves inbox control on click) already yield a verified
    // email, so both stay exempt from this gate.
    requireEmailVerification: true,
  },
  emailVerification: {
    // Re-send the link when an existing but unverified account tries to sign in,
    // so a booker who abandoned verification can recover from the funnel.
    sendOnSignIn: true,
    // Clicking the link both verifies the address and creates a session, so the
    // booker returns to the funnel URL (draft preserved in the query string)
    // already signed in and lands straight on the payment step.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      const locale = getEmailLocaleFromRequest(request);
      try {
        await sendVerificationEmail({ email: user.email, url, locale });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: "auth.email-verification" },
        });
        throw new APIError("INTERNAL_SERVER_ERROR", {
          code: "VERIFICATION_DELIVERY_FAILED",
          message: VERIFICATION_DELIVERY_FAILED_MESSAGE[locale],
        });
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    },
  },
  account: {
    // Auto-link Google sign-ins to an existing user that matches by email.
    // Without this, Better Auth rejects the second sign-in path with
    // `account_not_linked` whenever the user already has a magic-link or
    // email+password account on the same address. Google mandates a verified
    // email on its id_token (`email_verified=true`), so trusting it for the
    // link does not open a takeover vector — only providers that guarantee
    // pre-verification belong in this list.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRY_SECONDS,
      sendMagicLink: async ({ email, url }, ctx) => {
        const locale = getEmailLocaleFromRequest(ctx?.request);
        try {
          await sendMagicLinkEmail({ email, url, locale });
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: "auth.magic-link" },
          });
          throw new APIError("INTERNAL_SERVER_ERROR", {
            code: "MAGIC_LINK_DELIVERY_FAILED",
            message: MAGIC_LINK_DELIVERY_FAILED_MESSAGE[locale],
          });
        }
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    disableSessionRefresh: true,
  },
  // F-128: E2E only. The full auth suite fires many sign-up/sign-in requests in
  // parallel against a production build, where Better Auth's rate limiter is on
  // by default and 429s them — the sign-up then never creates the user and the
  // test helper's follow-up read fails. The test server sets
  // AUTH_RATE_LIMIT_DISABLED to turn the limiter off; production (Vercel) never
  // sets it, so real rate limiting is unaffected.
  ...(process.env.AUTH_RATE_LIMIT_DISABLED === "true"
    ? { rateLimit: { enabled: false as const } }
    : {}),
});
