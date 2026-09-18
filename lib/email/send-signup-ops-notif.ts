import "server-only";

import React from "react";
import type { Locale } from "@prisma/client";

import type { Db } from "@/lib/db";
import { OPS_NOTIFICATION_EMAIL } from "./recipients";
import { sendEmail, type EmailClient } from "./send-email";
import {
  getSignupOpsNotifCopy,
  SIGNUP_METHOD_LABEL,
  SignupOpsNotifEmail,
  type SignupMethod,
} from "./templates/signup-ops-notif";

// Ops notifications are internal → always English, like every operator surface.
const OPS_LOCALE: Locale = "en" as Locale;

export type SignupOpsNotifInput = {
  /** The new user's id — also the Resend idempotency key. */
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  method: SignupMethod;
};

export type SendSignupOpsNotifDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  /** Admin recipient override (tests). Defaults to OPS_NOTIFICATION_EMAIL. */
  opsEmail?: string;
};

export type SendSignupOpsNotifResult = {
  ok: true;
  emailId: string;
  recipient: string;
  total: number;
};

/**
 * F-146/F-151: notify the admin that a new account was created, so signups can
 * be monitored in real time. One email per account to the ops inbox, carrying
 * the person's email, name, signup method, locale, and the running account
 * total (which answers "how many people have signed up"). Fired once per account
 * from `databaseHooks.user.create.after`, so no per-user "sent" flag is needed;
 * the Resend idempotency key guards against an accidental double-fire.
 */
export async function sendSignupOpsNotifWith(
  deps: SendSignupOpsNotifDeps,
  input: SignupOpsNotifInput,
): Promise<SendSignupOpsNotifResult> {
  const opsEmail = deps.opsEmail ?? OPS_NOTIFICATION_EMAIL;
  // Running total including the account that just triggered this send.
  const total = await deps.prisma.user.count();
  const copy = getSignupOpsNotifCopy();

  const props = {
    email: input.email,
    name: normalizeName(input.name),
    method: input.method,
    locale: input.locale,
    total,
  };

  const sent = await deps.send(
    {
      to: [opsEmail],
      subject: copy.subject({ total, email: input.email }),
      react: React.createElement(SignupOpsNotifEmail, props),
      text: buildSignupOpsNotifPlainText({ copy, ...props }),
      tags: [
        { name: "feature", value: "auth" },
        { name: "kind", value: "signup-ops-notif" },
        { name: "locale", value: OPS_LOCALE },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `signup-ops-notif-${input.id}`,
    },
  );

  return { ok: true, emailId: sent.id, recipient: opsEmail, total };
}

/** Trim to a usable display name, or null (magic-link accounts may carry none). */
function normalizeName(name: string | null): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

function buildSignupOpsNotifPlainText(args: {
  copy: ReturnType<typeof getSignupOpsNotifCopy>;
  email: string;
  name: string | null;
  method: SignupMethod;
  locale: Locale;
  total: number;
}): string {
  const { copy } = args;
  return [
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.emailLabel}: ${args.email}`,
    `${copy.nameLabel}: ${args.name ?? copy.emptyName}`,
    `${copy.methodLabel}: ${SIGNUP_METHOD_LABEL[args.method]}`,
    `${copy.languageLabel}: ${args.locale.toUpperCase()}`,
    `${copy.totalLabel}: ${args.total}`,
    "",
    copy.signoff,
  ].join("\n");
}

/**
 * Map the Better Auth endpoint context to the creation path. The method is not
 * stored on the `User` row, so it must be inferred from which endpoint created
 * the account. Best-effort: an unrecognised path falls back to "other", which a
 * monitoring email tolerates.
 */
export function resolveSignupMethod(
  context?: { path?: string | null } | null,
): SignupMethod {
  const path = context?.path?.toLowerCase() ?? "";
  if (!path) return "other";
  // Order matters: the magic-link verify path also contains "sign-in".
  if (path.includes("magic-link")) return "magic-link";
  if (
    path.includes("callback") ||
    path.includes("oauth") ||
    path.includes("google")
  ) {
    return "google";
  }
  if (path.includes("sign-up") || path.includes("sign-in")) {
    return "email-password";
  }
  return "other";
}

/**
 * Production wrapper: resolves real Prisma + Resend deps and delegates. Called
 * best-effort (try/catch + Sentry) from the Better Auth user-create hook, so a
 * Resend outage never blocks or rolls back account creation.
 */
export async function sendSignupOpsNotif(
  input: SignupOpsNotifInput,
): Promise<SendSignupOpsNotifResult> {
  const { prisma } = await import("@/lib/db");
  return sendSignupOpsNotifWith({ prisma, send: sendEmail }, input);
}
