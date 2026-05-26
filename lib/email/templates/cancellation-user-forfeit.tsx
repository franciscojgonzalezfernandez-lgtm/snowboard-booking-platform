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

export type CancellationUserForfeitEmailProps = {
  locale: Locale;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  hoursBeforeStart: number;
  contactPhone: string;
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
  policyHeadline: string;
  policyBody: (args: { hours: number }) => string;
  exceptionIntro: string;
  exceptionTrailer: string;
  exceptionPhonePrefix: string;
  termsLine: string;
  termsLink: string;
  signoff: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    subject: (name) => `Your cancellation has been recorded, ${name}`,
    preview: "Your lesson was cancelled within the 48-hour window.",
    greeting: (name) => `Hi ${name},`,
    intro: "Your lesson has been cancelled.",
    summaryTitle: "Cancelled lesson",
    dateLabel: "Date",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    policyHeadline: "Cancellation policy",
    policyBody: ({ hours }) =>
      `Per our terms, cancellations within 48 hours of the lesson are not eligible for a credit or refund. Your lesson was cancelled ${hours} hours before its start time.`,
    exceptionIntro: "If you cancelled due to illness or emergency, please call us at",
    exceptionPhonePrefix: "",
    exceptionTrailer: " — we review exceptions case by case.",
    termsLine: "Full cancellation policy:",
    termsLink: "Terms & conditions",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name) => `Deine Stornierung wurde erfasst, ${name}`,
    preview: "Deine Stunde wurde innerhalb der 48-Stunden-Frist storniert.",
    greeting: (name) => `Hallo ${name},`,
    intro: "Deine Stunde wurde storniert.",
    summaryTitle: "Stornierte Stunde",
    dateLabel: "Datum",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    policyHeadline: "Stornierungsbedingungen",
    policyBody: ({ hours }) =>
      `Gemäss unseren AGB sind Stornierungen innerhalb von 48 Stunden vor der Stunde nicht erstattungsfähig. Deine Stunde wurde ${hours} Stunden vor Beginn storniert.`,
    exceptionIntro:
      "Falls du wegen Krankheit oder eines Notfalls absagen musstest, ruf uns bitte an:",
    exceptionPhonePrefix: "",
    exceptionTrailer: " — wir prüfen Ausnahmen im Einzelfall.",
    termsLine: "Vollständige Stornierungsbedingungen:",
    termsLink: "AGB",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name) => `Tu cancelación ha sido registrada, ${name}`,
    preview: "Tu clase ha sido cancelada dentro de las 48 horas previas.",
    greeting: (name) => `Hola ${name},`,
    intro: "Tu clase ha sido cancelada.",
    summaryTitle: "Clase cancelada",
    dateLabel: "Fecha",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    policyHeadline: "Política de cancelación",
    policyBody: ({ hours }) =>
      `Según nuestros términos, las cancelaciones dentro de las 48 horas previas a la clase no dan derecho a crédito ni reembolso. Tu clase fue cancelada ${hours} horas antes de su inicio.`,
    exceptionIntro:
      "Si has cancelado por enfermedad o emergencia, llámanos al",
    exceptionPhonePrefix: "",
    exceptionTrailer: " — revisamos cada excepción caso a caso.",
    termsLine: "Política completa de cancelación:",
    termsLink: "Términos y condiciones",
    signoff: "— Ride Flumserberg",
  },
};

export function getCancellationUserForfeitCopy(locale: Locale = "en"): Copy {
  return COPY[locale] ?? COPY.en;
}

export function CancellationUserForfeitEmail({
  locale,
  bookerName,
  bookingDateLabel,
  bookingDurationLabel,
  instructorName,
  hoursBeforeStart,
  contactPhone,
  termsUrl,
}: CancellationUserForfeitEmailProps) {
  const t = getCancellationUserForfeitCopy(locale);
  const telHref = `tel:${contactPhone.replace(/\s+/g, "")}`;

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

          <Section style={policyBlock}>
            <Text style={policyTitle}>{t.policyHeadline}</Text>
            <Text style={policyBody}>
              {t.policyBody({ hours: hoursBeforeStart })}
            </Text>
          </Section>

          <Text style={copy}>
            {t.exceptionIntro}{" "}
            <a href={telHref} style={link}>
              {contactPhone}
            </a>
            {t.exceptionTrailer}
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

const policyBlock = {
  backgroundColor: "#f7f5f0",
  border: "1px solid #ded8ce",
  margin: "8px 0 24px",
  padding: "20px 24px",
};

const policyTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const policyBody = {
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
