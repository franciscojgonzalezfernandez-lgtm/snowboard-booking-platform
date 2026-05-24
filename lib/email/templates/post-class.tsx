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

export type PostClassEmailProps = {
  locale: Locale;
  bookerName: string;
  instructorName: string;
  reviewUrl: string | null;
  tipUrl: string | null;
  bookAgainUrl: string;
  contactEmail: string;
};

type PostClassCopy = {
  subject: (instructor: string) => string;
  preview: string;
  greeting: (name: string) => string;
  body: (instructor: string) => string;
  reviewTitle: string;
  reviewBody: string;
  reviewCta: string;
  tipTitle: string;
  tipBody: (instructor: string) => string;
  tipCta: string;
  bookAgainCta: string;
  contactIntro: string;
  signoff: string;
};

const COPY: Record<Locale, PostClassCopy> = {
  en: {
    subject: (instructor: string) => `How was your lesson with ${instructor}?`,
    preview: "Quick feedback + tip your instructor if you loved it.",
    greeting: (name: string) => `Hi ${name},`,
    body: (instructor: string) =>
      `Thanks for riding with ${instructor} today. Hope the snow was good.`,
    reviewTitle: "Help others find us",
    reviewBody:
      "A two-minute Google review is the single best thing you can do for a small ski school. Honest words, what worked, what didn't.",
    reviewCta: "Leave a Google review",
    tipTitle: "Tip your instructor",
    tipBody: (instructor: string) =>
      `100% of tips go directly to ${instructor}. Cards, TWINT, Apple/Google Pay.`,
    tipCta: "Send a tip",
    bookAgainCta: "Book your next lesson",
    contactIntro: "Anything off? Reply to this email or write to",
    signoff: "— Ride Flumserberg",
  },
  de: {
    subject: (instructor: string) => `Wie war die Stunde mit ${instructor}?`,
    preview: "Kurzes Feedback + Trinkgeld für deinen Coach.",
    greeting: (name: string) => `Hallo ${name},`,
    body: (instructor: string) =>
      `Danke fürs Fahren mit ${instructor} heute. Hoffentlich war der Schnee gut.`,
    reviewTitle: "Hilf anderen, uns zu finden",
    reviewBody:
      "Eine kurze Google-Bewertung ist das Beste, was du für eine kleine Schule tun kannst. Ehrliche Worte, was geklappt hat, was nicht.",
    reviewCta: "Google-Bewertung schreiben",
    tipTitle: "Trinkgeld für deinen Coach",
    tipBody: (instructor: string) =>
      `100% des Trinkgelds gehen direkt an ${instructor}. Karte, TWINT, Apple/Google Pay.`,
    tipCta: "Trinkgeld senden",
    bookAgainCta: "Nächste Stunde buchen",
    contactIntro: "Etwas nicht passend? Antworte auf diese E-Mail oder schreibe an",
    signoff: "— Ride Flumserberg",
  },
  es: {
    subject: (instructor: string) => `¿Qué tal la clase con ${instructor}?`,
    preview: "Feedback rápido + propina para tu instructor si te gustó.",
    greeting: (name: string) => `Hola ${name},`,
    body: (instructor: string) =>
      `Gracias por riderear con ${instructor} hoy. Esperamos que la nieve fuera buena.`,
    reviewTitle: "Ayúdanos a que más gente nos encuentre",
    reviewBody:
      "Una reseña en Google de dos minutos es lo mejor que puedes hacer por una escuela pequeña. Palabras honestas, qué funcionó, qué no.",
    reviewCta: "Dejar reseña en Google",
    tipTitle: "Propina para tu instructor",
    tipBody: (instructor: string) =>
      `El 100% de las propinas va directamente a ${instructor}. Tarjeta, TWINT, Apple/Google Pay.`,
    tipCta: "Enviar propina",
    bookAgainCta: "Reservar próxima clase",
    contactIntro: "¿Algo que no encajó? Responde a este email o escribe a",
    signoff: "— Ride Flumserberg",
  },
};

export function getPostClassCopy(locale: Locale = "en"): PostClassCopy {
  return COPY[locale] ?? COPY.en;
}

export function PostClassEmail({
  locale,
  bookerName,
  instructorName,
  reviewUrl,
  tipUrl,
  bookAgainUrl,
  contactEmail,
}: PostClassEmailProps) {
  const t = getPostClassCopy(locale);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={greeting}>{t.greeting(bookerName)}</Text>
          <Text style={copy}>{t.body(instructorName)}</Text>

          {reviewUrl ? (
            <Section style={ctaBlock}>
              <Text style={ctaTitle}>{t.reviewTitle}</Text>
              <Text style={ctaBody}>{t.reviewBody}</Text>
              <Text style={ctaWrap}>
                <a href={reviewUrl} style={ctaLink}>
                  {t.reviewCta} →
                </a>
              </Text>
            </Section>
          ) : null}

          {tipUrl ? (
            <Section style={ctaBlock}>
              <Text style={ctaTitle}>{t.tipTitle}</Text>
              <Text style={ctaBody}>{t.tipBody(instructorName)}</Text>
              <Text style={ctaWrap}>
                <a href={tipUrl} style={ctaLink}>
                  {t.tipCta} →
                </a>
              </Text>
            </Section>
          ) : null}

          <Hr style={hr} />

          <Text style={copy}>
            <a href={bookAgainUrl} style={link}>
              {t.bookAgainCta}
            </a>
          </Text>

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

const ctaBlock = {
  backgroundColor: "#f7f5f0",
  border: "1px solid #ded8ce",
  margin: "16px 0",
  padding: "20px 24px",
};

const ctaTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const ctaBody = {
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 12px",
};

const ctaWrap = {
  margin: "0",
};

const ctaLink = {
  color: "#17130f",
  fontWeight: 600,
  textDecoration: "underline",
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
