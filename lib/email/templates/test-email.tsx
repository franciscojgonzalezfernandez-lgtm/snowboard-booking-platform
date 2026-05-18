import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type TestEmailProps = {
  domain: string;
};

export const TEST_EMAIL_SUBJECT = "Ride Flumserberg email test";

export function TestEmail({ domain }: TestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Resend is wired for Ride Flumserberg.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Email delivery is wired.</Heading>
          <Text style={copy}>
            This message was sent through Resend using the {domain} sender
            domain.
          </Text>
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
  fontSize: "28px",
  fontWeight: "400",
  lineHeight: "1.15",
  margin: "0 0 20px",
};

const copy = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0",
};
