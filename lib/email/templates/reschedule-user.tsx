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

export type RescheduleUserEmailProps = {
  locale: Locale;
  bookerName: string;
  oldDateLabel: string;
  oldAnchorTime: string;
  newDateLabel: string;
  newAnchorTime: string;
  bookingDurationLabel: string;
  instructorName: string;
  manageBookingUrl: string;
  termsUrl: string;
};

type Copy = {
  subject: (name: string) => string;
  preview: string;
  greeting: (name: string) => string;
  intro: string;
  noChargeNote: string;
  fromTitle: string;
  toTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorLabel: string;
  ctaLabel: string;
  termsLine: string;
  termsLink: string;
  signoff: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    subject: (name) => `Your lesson has been moved, ${name}`,
    preview: "Your Ride Flumserberg lesson was moved to a new time.",
    greeting: (name) => `Hi ${name},`,
    intro: "Your lesson has been moved. Here are the new details.",
    noChargeNote:
      "Nothing to pay — your original price carries over to the new time.",
    fromTitle: "Previous time",
    toTitle: "New time",
    dateLabel: "Date",
    timeLabel: "Time",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    ctaLabel: "View dashboard",
    termsLine: "Full booking policy:",
    termsLink: "Terms & conditions",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name) => `Deine Stunde wurde verschoben, ${name}`,
    preview: "Deine Stunde bei Ride Flumserberg wurde auf eine neue Zeit verschoben.",
    greeting: (name) => `Hallo ${name},`,
    intro: "Deine Stunde wurde verschoben. Hier sind die neuen Details.",
    noChargeNote:
      "Nichts zu bezahlen — dein ursprünglicher Preis gilt für die neue Zeit weiter.",
    fromTitle: "Bisherige Zeit",
    toTitle: "Neue Zeit",
    dateLabel: "Datum",
    timeLabel: "Uhrzeit",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    ctaLabel: "Zum Dashboard",
    termsLine: "Vollständige Buchungsbedingungen:",
    termsLink: "AGB",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name) => `Tu clase se ha movido, ${name}`,
    preview: "Tu clase de Ride Flumserberg se ha movido a un nuevo horario.",
    greeting: (name) => `Hola ${name},`,
    intro: "Tu clase se ha movido. Estos son los nuevos detalles.",
    noChargeNote:
      "No hay nada que pagar: tu precio original se mantiene en el nuevo horario.",
    fromTitle: "Horario anterior",
    toTitle: "Nuevo horario",
    dateLabel: "Fecha",
    timeLabel: "Hora",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    ctaLabel: "Ir al panel",
    termsLine: "Política completa de reservas:",
    termsLink: "Términos y condiciones",
    signoff: "— Ride Flumserberg",
  },
};

export function getRescheduleUserCopy(locale: Locale = "en"): Copy {
  return COPY[locale] ?? COPY.en;
}

export function RescheduleUserEmail({
  locale,
  bookerName,
  oldDateLabel,
  oldAnchorTime,
  newDateLabel,
  newAnchorTime,
  bookingDurationLabel,
  instructorName,
  manageBookingUrl,
  termsUrl,
}: RescheduleUserEmailProps) {
  const t = getRescheduleUserCopy(locale);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={greeting}>{t.greeting(bookerName)}</Text>
          <Text style={copy}>{t.intro}</Text>

          <Section style={summaryMuted}>
            <Text style={summaryTitleMuted}>{t.fromTitle}</Text>
            <Row label={t.dateLabel} value={oldDateLabel} />
            <Row label={t.timeLabel} value={oldAnchorTime} />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.toTitle}</Text>
            <Row label={t.dateLabel} value={newDateLabel} />
            <Row label={t.timeLabel} value={newAnchorTime} />
            <Row label={t.durationLabel} value={bookingDurationLabel} />
            <Row label={t.instructorLabel} value={instructorName} />
          </Section>

          <Text style={copy}>{t.noChargeNote}</Text>

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

const summaryMuted = {
  backgroundColor: "#ffffff",
  border: "1px solid #ded8ce",
  margin: "16px 0 8px",
  padding: "16px 24px",
  opacity: 0.75,
};

const summaryTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const summaryTitleMuted = {
  color: "#5f574f",
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
