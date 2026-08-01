import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { Locale } from "@prisma/client";

export type VerificationEmailProps = {
  url: string;
  locale?: Locale;
};

type VerificationCopy = {
  subject: string;
  preview: string;
  body: string;
  button: string;
  fallback: string;
  plainIntro: string;
  plainOutro: string;
  signoff: string;
};

// F-122: sent when an email+password account signs up (or an unverified one
// tries to sign in). Clicking the button verifies the address and — because
// `autoSignInAfterVerification` is on — returns the booker to the funnel URL
// (draft preserved in the query string) already signed in, ready to pay.
const COPY: Record<Locale, VerificationCopy> = {
  en: {
    subject: "Confirm your email to finish booking",
    preview: "Confirm your email to hold your Ride Flumserberg slot.",
    body: "Confirm this email address to finish booking your lesson. We ask for this once, to make sure the slot is held for a real booker — you will not need to do it again.",
    button: "Confirm email",
    fallback:
      "If the button does not work, paste this link into your browser:",
    plainIntro:
      "Confirm your email to finish booking your Ride Flumserberg lesson.",
    plainOutro:
      "The link expires shortly. Start the booking again if it has waited too long in your inbox.",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: "Bestätige deine E-Mail, um die Buchung abzuschliessen",
    preview:
      "Bestätige deine E-Mail, um deinen Ride-Flumserberg-Slot zu sichern.",
    body: "Bestätige diese E-Mail-Adresse, um deine Buchung abzuschliessen. Wir fragen das einmalig, damit der Slot für eine echte Buchung reserviert wird — du musst es kein zweites Mal tun.",
    button: "E-Mail bestätigen",
    fallback:
      "Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:",
    plainIntro:
      "Bestätige deine E-Mail, um deine Ride-Flumserberg-Buchung abzuschliessen.",
    plainOutro:
      "Der Link läuft bald ab. Starte die Buchung neu, falls er zu lange im Posteingang gewartet hat.",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: "Confirma tu correo para completar la reserva",
    preview: "Confirma tu correo para retener tu plaza en Ride Flumserberg.",
    body: "Confirma esta dirección de correo para completar tu reserva. Lo pedimos una sola vez, para asegurar que la plaza se reserva para alguien real — no tendrás que repetirlo.",
    button: "Confirmar correo",
    fallback: "Si el botón no funciona, copia este enlace en tu navegador:",
    plainIntro:
      "Confirma tu correo para completar tu reserva en Ride Flumserberg.",
    plainOutro:
      "El enlace caduca pronto. Vuelve a empezar la reserva si lleva demasiado tiempo en tu bandeja.",
    signoff: "— Ride Flumserberg",
  },
};

export function getVerificationCopy(locale: Locale = "en"): VerificationCopy {
  return COPY[locale] ?? COPY.en;
}

export function VerificationEmail({ url, locale = "en" }: VerificationEmailProps) {
  const t = getVerificationCopy(locale);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={copy}>{t.body}</Text>
          <Section style={buttonWrap}>
            <Button href={url} style={button}>
              {t.button}
            </Button>
          </Section>
          <Text style={secondaryCopy}>{t.fallback}</Text>
          <Text style={link}>{url}</Text>
        </Container>
      </Body>
    </Html>
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

const copy = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0",
};

const buttonWrap = {
  margin: "32px 0",
};

const button = {
  backgroundColor: "#17130f",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  letterSpacing: "0",
  padding: "14px 22px",
  textDecoration: "none",
};

const secondaryCopy = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
};

const link = {
  color: "#17130f",
  fontSize: "12px",
  lineHeight: "1.5",
  overflowWrap: "anywhere" as const,
};
