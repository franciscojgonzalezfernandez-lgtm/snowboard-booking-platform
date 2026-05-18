export class MissingEmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEmailConfigError";
  }
}

export type EmailConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
  testRecipient?: string;
};

const DEFAULT_FROM = "Ride Flumserberg <hello@rideflumserberg.ch>";

export function getEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailConfig {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new MissingEmailConfigError("RESEND_API_KEY is required to send email");
  }

  return {
    apiKey,
    from: env.EMAIL_FROM ?? DEFAULT_FROM,
    replyTo: env.EMAIL_REPLY_TO,
    testRecipient: env.EMAIL_TEST_RECIPIENT,
  };
}

export function canUseConsoleEmail(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !env.RESEND_API_KEY && env.NODE_ENV !== "production";
}

