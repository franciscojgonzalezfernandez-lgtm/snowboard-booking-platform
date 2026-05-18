import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email/send-magic-link-email";
import { getEmailLocaleFromRequest } from "@/lib/email/locale";

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
        try {
          await sendMagicLinkEmail({
            email,
            url,
            locale: getEmailLocaleFromRequest(ctx?.request),
          });
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: "auth.magic-link" },
          });
          throw err;
        }
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    disableSessionRefresh: true,
  },
});
