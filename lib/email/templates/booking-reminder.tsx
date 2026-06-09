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

export type BookingReminderEmailProps = {
  locale: Locale;
  bookerName: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorName: string;
  meetingPoint: string;
  contactEmail: string;
  contactPhone: string;
  manageBookingUrl: string;
};

type BookingReminderCopy = {
  subject: (name: string) => string;
  preview: string;
  greeting: (name: string) => string;
  body: string;
  summaryTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorLabel: string;
  meetingLabel: string;
  bringTitle: string;
  bringList: string[];
  calendarNote: string;
  manageLink: string;
  contactIntro: string;
  phoneNote: (phone: string) => string;
  signoff: string;
};

const COPY: Record<Locale, BookingReminderCopy> = {
  en: {
    subject: (name: string) => `See you tomorrow, ${name}`,
    preview: "Your snowboard lesson is in 24 hours.",
    greeting: (name: string) => `Hi ${name},`,
    body: "Quick reminder — your snowboard lesson is tomorrow. Below is everything you need.",
    summaryTitle: "Lesson details",
    dateLabel: "Date",
    timeLabel: "Start",
    durationLabel: "Length",
    instructorLabel: "Instructor",
    meetingLabel: "Meeting point",
    bringTitle: "Bring with you",
    bringList: [
      "Lift ticket (not included)",
      "Snowboard + boots (rental ok)",
      "Helmet (mandatory for under 18, recommended for all)",
      "Goggles, gloves, layers",
    ],
    calendarNote:
      "We re-attached the calendar invite in case it slipped from yours.",
    manageLink: "View this booking",
    contactIntro: "Running late or need to change something? Reply to this email or write to",
    phoneNote: (phone: string) => `Same-day emergencies: call ${phone}.`,
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (name: string) => `Bis morgen, ${name}`,
    preview: "Deine Snowboard-Stunde ist in 24 Stunden.",
    greeting: (name: string) => `Hallo ${name},`,
    body: "Kurze Erinnerung — deine Snowboard-Stunde ist morgen. Alle Details unten.",
    summaryTitle: "Stundendetails",
    dateLabel: "Datum",
    timeLabel: "Beginn",
    durationLabel: "Dauer",
    instructorLabel: "Coach",
    meetingLabel: "Treffpunkt",
    bringTitle: "Bring mit",
    bringList: [
      "Skipass (nicht inklusive)",
      "Snowboard + Boots (Verleih möglich)",
      "Helm (Pflicht unter 18, empfohlen für alle)",
      "Brille, Handschuhe, Schichten",
    ],
    calendarNote:
      "Wir haben die Kalendereinladung erneut angehängt, falls sie verloren ging.",
    manageLink: "Buchung ansehen",
    contactIntro: "Verspätung oder Änderung? Antworte auf diese E-Mail oder schreibe an",
    phoneNote: (phone: string) => `Notfälle am gleichen Tag: ${phone}.`,
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (name: string) => `Hasta mañana, ${name}`,
    preview: "Tu clase de snowboard es en 24 horas.",
    greeting: (name: string) => `Hola ${name},`,
    body: "Recordatorio rápido — tu clase de snowboard es mañana. Abajo tienes todos los detalles.",
    summaryTitle: "Detalles de la clase",
    dateLabel: "Fecha",
    timeLabel: "Inicio",
    durationLabel: "Duración",
    instructorLabel: "Instructor",
    meetingLabel: "Punto de encuentro",
    bringTitle: "Trae contigo",
    bringList: [
      "Forfait (no incluido)",
      "Snowboard + botas (alquiler posible)",
      "Casco (obligatorio para menores de 18, recomendado para todos)",
      "Gafas, guantes, capas",
    ],
    calendarNote:
      "Volvemos a adjuntar la invitación de calendario por si se te perdió.",
    manageLink: "Ver esta reserva",
    contactIntro: "¿Retraso o cambio? Responde a este email o escribe a",
    phoneNote: (phone: string) => `Emergencias del día: llama al ${phone}.`,
    signoff: "— Ride Flumserberg",
  },
};

export function getBookingReminderCopy(
  locale: Locale = "en",
): BookingReminderCopy {
  return COPY[locale] ?? COPY.en;
}

export function BookingReminderEmail({
  locale,
  bookerName,
  dateLabel,
  timeLabel,
  durationLabel,
  instructorName,
  meetingPoint,
  contactEmail,
  contactPhone,
  manageBookingUrl,
}: BookingReminderEmailProps) {
  const t = getBookingReminderCopy(locale);

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
            <Row label={t.meetingLabel} value={meetingPoint} />
          </Section>

          <Section style={listSection}>
            <Text style={summaryTitle}>{t.bringTitle}</Text>
            {t.bringList.map((item) => (
              <Text key={item} style={listItem}>
                · {item}
              </Text>
            ))}
          </Section>

          <Text style={copy}>{t.calendarNote}</Text>

          <Text style={copy}>
            <a href={manageBookingUrl} style={link}>
              {t.manageLink}
            </a>
          </Text>

          <Hr style={hr} />

          <Text style={secondaryCopy}>
            {t.contactIntro}{" "}
            <a href={`mailto:${contactEmail}`} style={link}>
              {contactEmail}
            </a>
            .
          </Text>
          <Text style={secondaryCopy}>{t.phoneNote(contactPhone)}</Text>

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
  margin: "16px 0 16px",
  padding: "20px 24px",
};

const listSection = {
  margin: "0 0 24px",
  padding: "0 24px",
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

const listItem = {
  color: "#17130f",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 4px",
};

const hr = {
  borderColor: "#ded8ce",
  margin: "24px 0 16px",
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
