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

export type BookingConfirmedEmailProps = {
  locale: Locale;
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
  attendeesLabel: string;
  attendeesValue: (count: number) => string;
  totalLabel: string;
  vatNote: string;
  calendarNote: string;
  manageLink: string;
  cancellationNote: string;
  contactIntro: string;
  signoff: string;
};

const COPY: Record<Locale, BookingConfirmedCopy> = {
  en: {
    subject: (name: string) => `Your snowboard lesson is booked, ${name}`,
    preview: "Your Ride Flumserberg booking is confirmed.",
    greeting: (name: string) => `Hi ${name},`,
    body: "Your lesson is confirmed. See you on the mountain. Below is everything you need.",
    summaryTitle: "Lesson details",
    dateLabel: "Date",
    timeLabel: "Start",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    attendeesLabel: "Attendees",
    attendeesValue: (count: number) =>
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
    subject: (name: string) => `Deine Snowboard-Stunde ist gebucht, ${name}`,
    preview: "Deine Buchung bei Ride Flumserberg ist bestätigt.",
    greeting: (name: string) => `Hallo ${name},`,
    body: "Deine Stunde ist bestätigt. Bis auf dem Berg. Alle Details unten.",
    summaryTitle: "Stundendetails",
    dateLabel: "Datum",
    timeLabel: "Beginn",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    attendeesLabel: "Teilnehmende",
    attendeesValue: (count: number) =>
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
    subject: (name: string) => `Tu clase de snowboard está reservada, ${name}`,
    preview: "Tu reserva en Ride Flumserberg está confirmada.",
    greeting: (name: string) => `Hola ${name},`,
    body: "Tu clase está confirmada. Nos vemos en la montaña. Abajo tienes todos los detalles.",
    summaryTitle: "Detalles de la clase",
    dateLabel: "Fecha",
    timeLabel: "Inicio",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    attendeesLabel: "Participantes",
    attendeesValue: (count: number) =>
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
  locale: Locale = "en",
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

            <InfoRow label={t.dateLabel} value={dateLabel} />
            <InfoRow label={t.timeLabel} value={timeLabel} />
            <InfoRow label={t.durationLabel} value={durationLabel} />
            <InfoRow label={t.instructorLabel} value={instructorName} />
            <InfoRow
              label={t.attendeesLabel}
              value={t.attendeesValue(attendeesCount)}
            />

            <Hr style={hr} />

            <InfoRow label={t.totalLabel} value={totalLabel} bold />
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

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  // Stacked layout (label on top, value below). Gmail and Outlook both strip
  // CSS flex/grid, which collapsed the previous side-by-side row into
  // "Label:Value" with no whitespace. Stacking dodges that class of bug for
  // good and reads more editorial — small tracked caps over a larger value.
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding="0"
      cellSpacing="0"
      border={0}
      style={rowTable}
    >
      <tbody>
        <tr>
          <td style={rowCell}>
            <div style={rowLabel}>{label}</div>
            <div
              style={{
                ...rowValue,
                fontSize: bold ? "18px" : "16px",
                fontWeight: bold ? 600 : 400,
              }}
            >
              {value}
            </div>
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
  margin: "0 0 14px",
  textTransform: "uppercase" as const,
};

const rowTable = {
  width: "100%",
  borderCollapse: "collapse" as const,
  margin: "0 0 14px",
};

const rowCell = {
  padding: "0",
};

const rowLabel = {
  color: "#8a7f74",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.16em",
  lineHeight: "1.4",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
};

const rowValue = {
  color: "#17130f",
  lineHeight: "1.4",
  margin: "0",
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
