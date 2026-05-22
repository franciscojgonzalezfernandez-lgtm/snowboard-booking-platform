import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email/send-magic-link-email";
import { getEmailLocaleFromRequest } from "@/lib/email/locale";
import type { Locale } from "@prisma/client";

const MAGIC_LINK_DELIVERY_FAILED_MESSAGE: Record<Locale, string> = {
  en: "Could not send the sign-in email. Please try again in a moment.",
  de: "Anmelde-E-Mail konnte nicht gesendet werden. Bitte versuche es gleich erneut.",
  es: "No se pudo enviar el correo de acceso. Inténtalo de nuevo en un momento.",
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    },
  },
  plugins: [
    magicLink({
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
});
