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

export type CancellationUserCreditEmailProps = {
  locale: Locale;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  creditAmountLabel: string;
  creditExpiresAtLabel: string;
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
  creditHeadline: string;
  creditBody: (args: { amount: string; expiresAt: string }) => string;
  ctaLabel: string;
  termsLine: string;
  termsLink: string;
  signoff: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    subject: (name) => `Your cancellation is confirmed, ${name}`,
    preview: "Your Ride Flumserberg lesson was cancelled and a credit issued.",
    greeting: (name) => `Hi ${name},`,
    intro:
      "Your lesson has been cancelled. Because you cancelled more than 48 hours in advance, you are eligible for a credit.",
    summaryTitle: "Cancelled lesson",
    dateLabel: "Date",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    creditHeadline: "Your credit",
    creditBody: ({ amount, expiresAt }) =>
      `We've issued a ${amount} credit. It expires on ${expiresAt}. Apply it at checkout on your next booking.`,
    ctaLabel: "View dashboard",
    termsLine: "Full cancellation policy:",
    termsLink: "Terms & conditions",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name) => `Deine Stornierung ist bestätigt, ${name}`,
    preview: "Deine Stunde wurde storniert und ein Guthaben ausgestellt.",
    greeting: (name) => `Hallo ${name},`,
    intro:
      "Deine Stunde wurde storniert. Da du mehr als 48 Stunden im Voraus abgesagt hast, erhältst du ein Guthaben.",
    summaryTitle: "Stornierte Stunde",
    dateLabel: "Datum",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    creditHeadline: "Dein Guthaben",
    creditBody: ({ amount, expiresAt }) =>
      `Wir haben dir ein Guthaben über ${amount} gutgeschrieben. Es ist bis ${expiresAt} gültig. Du kannst es bei deiner nächsten Buchung im Checkout einlösen.`,
    ctaLabel: "Zum Dashboard",
    termsLine: "Vollständige Stornierungsbedingungen:",
    termsLink: "AGB",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name) => `Tu cancelación está confirmada, ${name}`,
    preview: "Tu clase ha sido cancelada y te hemos emitido un crédito.",
    greeting: (name) => `Hola ${name},`,
    intro:
      "Tu clase ha sido cancelada. Al cancelar con más de 48 horas de antelación, te corresponde un crédito.",
    summaryTitle: "Clase cancelada",
    dateLabel: "Fecha",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    creditHeadline: "Tu crédito",
    creditBody: ({ amount, expiresAt }) =>
      `Hemos emitido un crédito de ${amount}. Caduca el ${expiresAt}. Aplícalo en el checkout de tu próxima reserva.`,
    ctaLabel: "Ir al panel",
    termsLine: "Política completa de cancelación:",
    termsLink: "Términos y condiciones",
    signoff: "— Ride Flumserberg",
  },
};

export function getCancellationUserCreditCopy(locale: Locale = "en"): Copy {
  return COPY[locale] ?? COPY.en;
}

export function CancellationUserCreditEmail({
  locale,
  bookerName,
  bookingDateLabel,
  bookingDurationLabel,
  instructorName,
  creditAmountLabel,
  creditExpiresAtLabel,
  manageBookingUrl,
  termsUrl,
}: CancellationUserCreditEmailProps) {
  const t = getCancellationUserCreditCopy(locale);

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

          <Section style={creditBlock}>
            <Text style={creditTitle}>{t.creditHeadline}</Text>
            <Text style={creditAmount}>{creditAmountLabel}</Text>
            <Text style={creditBody}>
              {t.creditBody({
                amount: creditAmountLabel,
                expiresAt: creditExpiresAtLabel,
              })}
            </Text>
          </Section>

          <Text style={copy}>
            <a href={manageBookingUrl} style={link}>
              {t.ctaLabel}
            </a>
          </Text>

          <Hr style={hr} />

          <Text style={secondaryCopy}>
            {t.termsLine}{" "}
            <a href={termsUrl} style={link}>
              {t.termsLink}
            </a>
            .
          </Text>

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
  fontSize: "32px",
  fontWeight: "400",
  lineHeight: "1.1",
  margin: "0 0 24px",
};

const greeting = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 12px",
};

const copy = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const summary = {
  backgroundColor: "#f7f5f0",
  border: "1px solid #ded8ce",
  margin: "16px 0 24px",
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

const creditBlock = {
  backgroundColor: "#17130f",
  color: "#f7f5f0",
  margin: "8px 0 24px",
  padding: "24px",
};

const creditTitle = {
  color: "#a8a097",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const creditAmount = {
  color: "#f7f5f0",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "28px",
  fontWeight: 400,
  lineHeight: "1.2",
  margin: "0 0 12px",
};

const creditBody = {
  color: "#ded8ce",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
};

const hr = {
  borderColor: "#ded8ce",
  margin: "16px 0",
};

const secondaryCopy = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const link = {
  color: "#17130f",
  fontWeight: 600,
  textDecoration: "underline",
};

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
