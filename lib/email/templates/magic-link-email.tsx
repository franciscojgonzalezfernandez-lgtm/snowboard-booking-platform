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

export type MagicLinkEmailProps = {
  url: string;
};

export const MAGIC_LINK_EMAIL_SUBJECT = "Your Ride Flumserberg sign-in link";

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Open your secure sign-in link for Ride Flumserberg.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={copy}>
            Use this secure link to finish signing in. It expires shortly, so
            request a new one if this email has been waiting in your inbox.
          </Text>
          <Section style={buttonWrap}>
            <Button href={url} style={button}>
              Sign in
            </Button>
          </Section>
          <Text style={secondaryCopy}>
            If the button does not work, paste this link into your browser:
          </Text>
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
