import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { Locale } from "@prisma/client";

/**
 * F-152: internal "new account" notification for the admin. Fired once per
 * account from the Better Auth `databaseHooks.user.create.after` hook, covering
 * all three creation paths (email+password, magic link, Google). English-only,
 * like every ops surface. Mirrors the shape of `BookingOpsNotifEmail` so the
 * operational emails read as a set.
 */

/** How the account was created. Derived from the Better Auth endpoint context. */
export type SignupMethod = "google" | "magic-link" | "email-password" | "other";

export const SIGNUP_METHOD_LABEL: Record<SignupMethod, string> = {
  google: "Google",
  "magic-link": "Magic link",
  "email-password": "Email + password",
  other: "Other",
};

export type SignupOpsNotifEmailProps = {
  email: string;
  /** Display name if the account carried one; null for e.g. magic-link signups. */
  name: string | null;
  method: SignupMethod;
  locale: Locale;
  /** Total accounts on the platform, including this one. */
  total: number;
};

type Copy = {
  subject: (args: { total: number; email: string }) => string;
  preview: string;
  heading: string;
  intro: string;
  summaryTitle: string;
  emailLabel: string;
  nameLabel: string;
  methodLabel: string;
  languageLabel: string;
  totalLabel: string;
  emptyName: string;
  signoff: string;
};

const COPY: Copy = {
  subject: ({ total, email }) => `New signup #${total} — ${email}`,
  preview: "A new account was created.",
  heading: "Ride Flumserberg · Ops",
  intro: "A new account was just created.",
  summaryTitle: "New account",
  emailLabel: "Email",
  nameLabel: "Name",
  methodLabel: "Signup method",
  languageLabel: "Language",
  totalLabel: "Total accounts",
  emptyName: "—",
  signoff: "— automated notification",
};

export function getSignupOpsNotifCopy(): Copy {
  return COPY;
}

export function SignupOpsNotifEmail(props: SignupOpsNotifEmailProps) {
  const { email, name, method, locale, total } = props;
  const t = getSignupOpsNotifCopy();

  return (
    <Html lang="en">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={copy}>{t.intro}</Text>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.summaryTitle}</Text>
            <Row label={t.emailLabel} value={email} />
            <Row label={t.nameLabel} value={name ?? t.emptyName} />
            <Row label={t.methodLabel} value={SIGNUP_METHOD_LABEL[method]} />
            <Row label={t.languageLabel} value={locale.toUpperCase()} />
            <Row label={t.totalLabel} value={String(total)} />
          </Section>

          <Text style={signoff}>{t.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding="0"
      cellSpacing="0"
      border={0}
      style={row}
    >
      <tbody>
        <tr>
          <td style={rowLabel}>{label}</td>
          <td style={rowValue} align="right">
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const body = {
  backgroundColor: "#f7f5f0",
  color: "#17130f",
  fontFamily:
    "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: "0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #ded8ce",
  margin: "40px auto",
  maxWidth: "560px",
  padding: "40px",
};

const heading = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "24px",
  fontWeight: "400",
  lineHeight: "1.1",
  margin: "0 0 24px",
};

const copy = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const summary = {
  backgroundColor: "#f7f5f0",
  border: "1px solid #ded8ce",
  margin: "8px 0 16px",
  padding: "20px 24px",
};

const summaryTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const row = {
  borderCollapse: "collapse" as const,
  margin: "0 0 4px",
  width: "100%",
};

const rowLabel = {
  color: "#5f574f",
  fontSize: "14px",
  lineHeight: "1.6",
  padding: "0",
};

const rowValue = {
  color: "#17130f",
  fontSize: "14px",
  lineHeight: "1.6",
  padding: "0",
  textAlign: "right" as const,
};

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
