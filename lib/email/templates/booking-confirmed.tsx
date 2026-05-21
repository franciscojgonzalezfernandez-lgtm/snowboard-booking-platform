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

import type { EmailLocale } from "../locale";

export type BookingConfirmedEmailProps = {
  locale: EmailLocale;
  bookerName: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorName: string;
  attendeesCount: number;
  totalLabel: string;
  contactEmail: string;
  manageBookingUrl: string;
};

type BookingConfirmedCopy = {
  subject: (name: string) => string;
  preview: string;
  greeting: (name: string) => string;
  body: string;
  summaryTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorLabel: string;
  attendeesLabel: (count: number) => string;
  totalLabel: string;
  vatNote: string;
  calendarNote: string;
  manageLink: string;
  cancellationNote: string;
  contactIntro: string;
  signoff: string;
};

const COPY: Record<EmailLocale, BookingConfirmedCopy> = {
  en: {
    subject: (name: string) =>
      `Your snowboard lesson is booked, ${name}`,
    preview: "Your Ride Flumserberg booking is confirmed.",
    greeting: (name: string) => `Hi ${name},`,
    body: "Your lesson is confirmed. See you on the mountain. Below is everything you need.",
    summaryTitle: "Lesson details",
    dateLabel: "Date",
    timeLabel: "Start",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    attendeesLabel: (count: number) =>
      count === 1 ? "1 rider" : `${count} riders`,
    totalLabel: "Total",
    vatNote: "CHF, VAT included.",
    calendarNote:
      "A calendar invite is attached. Open the file on your phone or laptop to add it to your calendar.",
    manageLink: "Manage this booking",
    cancellationNote:
      "Need to cancel? Up to 48 hours before the lesson we issue a credit valid for one year. Within 48 hours the lesson fee is forfeited (medical certificate accepted as an exception).",
    contactIntro: "Questions? Reply to this email or write to",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name: string) =>
      `Deine Snowboard-Stunde ist gebucht, ${name}`,
    preview: "Deine Buchung bei Ride Flumserberg ist bestätigt.",
    greeting: (name: string) => `Hallo ${name},`,
    body: "Deine Stunde ist bestätigt. Bis auf dem Berg. Alle Details unten.",
    summaryTitle: "Stundendetails",
    dateLabel: "Datum",
    timeLabel: "Beginn",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    attendeesLabel: (count: number) =>
      count === 1 ? "1 Fahrer:in" : `${count} Fahrer:innen`,
    totalLabel: "Gesamt",
    vatNote: "CHF, inkl. MwSt.",
    calendarNote:
      "Eine Kalendereinladung liegt bei. Öffne die Datei auf dem Handy oder Laptop, um sie deinem Kalender hinzuzufügen.",
    manageLink: "Buchung verwalten",
    cancellationNote:
      "Du musst absagen? Bis 48 Stunden vor der Stunde stellen wir ein Guthaben aus, das ein Jahr gültig ist. Innerhalb von 48 Stunden verfällt die Gebühr (Arztzeugnis als Ausnahme akzeptiert).",
    contactIntro: "Fragen? Antworte auf diese E-Mail oder schreibe an",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name: string) =>
      `Tu clase de snowboard está reservada, ${name}`,
    preview: "Tu reserva en Ride Flumserberg está confirmada.",
    greeting: (name: string) => `Hola ${name},`,
    body: "Tu clase está confirmada. Nos vemos en la montaña. Abajo tienes todos los detalles.",
    summaryTitle: "Detalles de la clase",
    dateLabel: "Fecha",
    timeLabel: "Inicio",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    attendeesLabel: (count: number) =>
      count === 1 ? "1 rider" : `${count} riders`,
    totalLabel: "Total",
    vatNote: "CHF, IVA incluido.",
    calendarNote:
      "Adjuntamos una invitación de calendario. Abre el archivo en tu móvil o portátil para añadirlo a tu calendario.",
    manageLink: "Gestionar esta reserva",
    cancellationNote:
      "¿Necesitas cancelar? Hasta 48 horas antes de la clase emitimos un crédito válido durante un año. Dentro de las 48 horas, el importe se pierde (se acepta certificado médico como excepción).",
    contactIntro: "¿Dudas? Responde a este email o escribe a",
    signoff: "— Ride Flumserberg",
  },
};

export function getBookingConfirmedCopy(
  locale: EmailLocale = "en",
): BookingConfirmedCopy {
  return COPY[locale] ?? COPY.en;
}

export function BookingConfirmedEmail({
  locale,
  bookerName,
  dateLabel,
  timeLabel,
  durationLabel,
  instructorName,
  attendeesCount,
  totalLabel,
  contactEmail,
  manageBookingUrl,
}: BookingConfirmedEmailProps) {
  const t = getBookingConfirmedCopy(locale);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={greeting}>{t.greeting(bookerName)}</Text>
          <Text style={copy}>{t.body}</Text>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.summaryTitle}</Text>
            <Row label={t.dateLabel} value={dateLabel} />
            <Row label={t.timeLabel} value={timeLabel} />
            <Row label={t.durationLabel} value={durationLabel} />
            <Row label={t.instructorLabel} value={instructorName} />
            <Row label={t.attendeesLabel(attendeesCount)} value="" />
            <Hr style={hr} />
            <Row label={t.totalLabel} value={totalLabel} bold />
            <Text style={vatNote}>{t.vatNote}</Text>
          </Section>

          <Text style={copy}>{t.calendarNote}</Text>

          <Text style={copy}>
            <a href={manageBookingUrl} style={link}>
              {t.manageLink}
            </a>
          </Text>

          <Hr style={hr} />

          <Text style={secondaryCopy}>{t.cancellationNote}</Text>
          <Text style={secondaryCopy}>
            {t.contactIntro}{" "}
            <a href={`mailto:${contactEmail}`} style={link}>
              {contactEmail}
            </a>
            .
          </Text>

          <Text style={signoff}>{t.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <Text style={{ ...row, fontWeight: bold ? 600 : 400 }}>
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

const hr = {
  borderColor: "#ded8ce",
  margin: "16px 0",
};

const vatNote = {
  color: "#5f574f",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "8px 0 0",
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
