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
import type { EmailLocale } from "../locale";

export type MagicLinkEmailProps = {
  url: string;
  locale?: EmailLocale;
};

type MagicLinkCopy = {
  subject: string;
  preview: string;
  body: string;
  button: string;
  fallback: string;
  plainIntro: string;
  plainOutro: string;
  signoff: string;
};

const COPY: Record<EmailLocale, MagicLinkCopy> = {
  en: {
    subject: "Your Ride Flumserberg sign-in link",
    preview: "Open your secure sign-in link for Ride Flumserberg.",
    body: "Use this secure link to finish signing in. It expires shortly, so request a new one if this email has been waiting in your inbox.",
    button: "Sign in",
    fallback:
      "If the button does not work, paste this link into your browser:",
    plainIntro:
      "Use this secure link to finish signing in to Ride Flumserberg.",
    plainOutro:
      "The link expires shortly. Request a new one from the sign-in page if needed.",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: "Dein Anmelde-Link für Ride Flumserberg",
    preview: "Öffne deinen sicheren Anmelde-Link für Ride Flumserberg.",
    body: "Verwende diesen sicheren Link, um deine Anmeldung abzuschliessen. Er läuft bald ab — fordere einen neuen an, falls diese E-Mail in deinem Posteingang gewartet hat.",
    button: "Anmelden",
    fallback:
      "Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:",
    plainIntro:
      "Verwende diesen sicheren Link, um deine Anmeldung bei Ride Flumserberg abzuschliessen.",
    plainOutro:
      "Der Link läuft bald ab. Bei Bedarf fordere einen neuen über die Anmeldeseite an.",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: "Tu enlace de acceso a Ride Flumserberg",
    preview: "Abre tu enlace seguro de acceso a Ride Flumserberg.",
    body: "Usa este enlace seguro para completar tu acceso. Caduca pronto — pide uno nuevo si este correo lleva tiempo en tu bandeja.",
    button: "Iniciar sesión",
    fallback: "Si el botón no funciona, copia este enlace en tu navegador:",
    plainIntro:
      "Usa este enlace seguro para completar tu acceso a Ride Flumserberg.",
    plainOutro:
      "El enlace caduca pronto. Pide uno nuevo en la página de acceso si lo necesitas.",
    signoff: "— Ride Flumserberg",
  },
};

export function getMagicLinkCopy(
  locale: EmailLocale = "en",
): MagicLinkCopy {
  return COPY[locale] ?? COPY.en;
}

export function MagicLinkEmail({ url, locale = "en" }: MagicLinkEmailProps) {
  const t = getMagicLinkCopy(locale);

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
