import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { Locale } from "@prisma/client";

// Ops-cancellation booker email (F-078, ADR-008). Single template covers all
// three money-back paths — cash refund only, credit re-emit only, mixed —
// via conditional sections. Tone is owner-driven: "we had to cancel,
// here's what we did about it".

export type CancellationUserOpsEmailProps = {
  locale: Locale;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  /** Cash refund issued in CHF; null when ops cancelled a fully credit-paid
   * booking (nothing to refund) or a never-paid PENDING_PAYMENT draft. */
  cashRefundLabel: string | null;
  /** Credit re-emitted in CHF; null when the original booking was paid
   * 100% in cash. */
  creditAmountLabel: string | null;
  /** Expiry of the re-emitted credit. Pair with `creditAmountLabel`. */
  creditExpiresAtLabel: string | null;
  manageBookingUrl: string;
  termsUrl: string;
};

type Copy = {
  subject: (name: string) => string;
  preview: string;
  greeting: (name: string) => string;
  intro: string;
  summaryTitle: string;
  dateLabel: string;
  durationLabel: string;
  instructorLabel: string;
  refundHeadline: string;
  refundBody: (amount: string) => string;
  creditHeadline: string;
  creditBody: (args: { amount: string; expiresAt: string }) => string;
  ctaLabel: string;
  termsLine: string;
  signoff: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    subject: (name) =>
      `We had to cancel your lesson, ${name}`,
    preview: "We had to cancel your Ride Flumserberg lesson.",
    greeting: (name) => `Hi ${name},`,
    intro:
      "We had to cancel your lesson on our side. We're sorry about the inconvenience — here's what we did.",
    summaryTitle: "Cancelled lesson",
    dateLabel: "Date",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    refundHeadline: "Refund",
    refundBody: (amount) =>
      `We've refunded ${amount} to your card. It typically appears within 3–5 business days.`,
    creditHeadline: "Credit",
    creditBody: ({ amount, expiresAt }) =>
      `We've issued a ${amount} credit. It expires on ${expiresAt}. Apply it at checkout on your next booking.`,
    ctaLabel: "View dashboard",
    termsLine: "Full terms:",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name) => `Wir mussten deine Stunde absagen, ${name}`,
    preview: "Wir mussten deine Ride Flumserberg Stunde absagen.",
    greeting: (name) => `Hallo ${name},`,
    intro:
      "Wir mussten deine Stunde unsererseits absagen. Es tut uns leid — so haben wir es geregelt.",
    summaryTitle: "Stornierte Stunde",
    dateLabel: "Datum",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    refundHeadline: "Rückerstattung",
    refundBody: (amount) =>
      `Wir haben ${amount} auf deine Karte zurückerstattet. Die Gutschrift erscheint typischerweise in 3–5 Werktagen.`,
    creditHeadline: "Guthaben",
    creditBody: ({ amount, expiresAt }) =>
      `Wir haben dir ein Guthaben über ${amount} gutgeschrieben. Es ist bis ${expiresAt} gültig. Du kannst es bei deiner nächsten Buchung einlösen.`,
    ctaLabel: "Zum Dashboard",
    termsLine: "Vollständige AGB:",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name) => `Hemos tenido que cancelar tu clase, ${name}`,
    preview: "Hemos tenido que cancelar tu clase en Ride Flumserberg.",
    greeting: (name) => `Hola ${name},`,
    intro:
      "Hemos tenido que cancelar tu clase por nuestra parte. Sentimos las molestias — esto es lo que hemos hecho.",
    summaryTitle: "Clase cancelada",
    dateLabel: "Fecha",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    refundHeadline: "Reembolso",
    refundBody: (amount) =>
      `Hemos reembolsado ${amount} a tu tarjeta. Suele aparecer en 3–5 días laborables.`,
    creditHeadline: "Crédito",
    creditBody: ({ amount, expiresAt }) =>
      `Hemos emitido un crédito de ${amount}. Caduca el ${expiresAt}. Aplícalo en el checkout de tu próxima reserva.`,
    ctaLabel: "Ir al panel",
    termsLine: "Términos completos:",
    signoff: "— Ride Flumserberg",
  },
};

export function getCancellationUserOpsCopy(locale: Locale): Copy {
  return COPY[locale];
}

export function CancellationUserOpsEmail(props: CancellationUserOpsEmailProps) {
  const {
    locale,
    bookerName,
    bookingDateLabel,
    bookingDurationLabel,
    instructorName,
    cashRefundLabel,
    creditAmountLabel,
    creditExpiresAtLabel,
    manageBookingUrl,
    termsUrl,
  } = props;
  const t = getCancellationUserOpsCopy(locale);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={greeting}>{t.greeting(bookerName)}</Text>
          <Text style={copy}>{t.intro}</Text>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.summaryTitle}</Text>
            <Row label={t.dateLabel} value={bookingDateLabel} />
            <Row label={t.durationLabel} value={bookingDurationLabel} />
            <Row label={t.instructorLabel} value={instructorName} />
          </Section>

          {cashRefundLabel ? (
            <Section style={callout}>
              <Text style={calloutTitle}>{t.refundHeadline}</Text>
              <Text style={calloutBody}>{t.refundBody(cashRefundLabel)}</Text>
            </Section>
          ) : null}

          {creditAmountLabel && creditExpiresAtLabel ? (
            <Section style={callout}>
              <Text style={calloutTitle}>{t.creditHeadline}</Text>
              <Text style={calloutBody}>
                {t.creditBody({
                  amount: creditAmountLabel,
                  expiresAt: creditExpiresAtLabel,
                })}
              </Text>
            </Section>
          ) : null}

          <Section style={ctaSection}>
            <a href={manageBookingUrl} style={ctaLink}>
              {t.ctaLabel}
            </a>
          </Section>

          <Hr style={hr} />
          <Text style={fineprint}>
            {t.termsLine}{" "}
            <a href={termsUrl} style={inlineLink}>
              {termsUrl}
            </a>
          </Text>
          <Text style={signoff}>{t.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={row}>
      <span style={rowLabel}>{label}</span>
      <span style={rowValue}>{value}</span>
    </Text>
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

const greeting = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 8px",
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

const callout = {
  backgroundColor: "#fff8ee",
  border: "1px solid #f0d8a8",
  margin: "8px 0 16px",
  padding: "20px 24px",
};

const calloutTitle = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const calloutBody = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
};

const row = {
  display: "flex" as const,
  fontSize: "14px",
  justifyContent: "space-between" as const,
  lineHeight: "1.6",
  margin: "0 0 4px",
};

const rowLabel = {
  color: "#5f574f",
};

const rowValue = {
  color: "#17130f",
};

const ctaSection = {
  margin: "24px 0 0",
};

const ctaLink = {
  backgroundColor: "#17130f",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  padding: "12px 22px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};

const hr = {
  borderColor: "#ded8ce",
  margin: "32px 0 16px",
};

const fineprint = {
  color: "#5f574f",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const inlineLink = {
  color: "#5f574f",
  textDecoration: "underline",
};

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "16px 0 0",
};
