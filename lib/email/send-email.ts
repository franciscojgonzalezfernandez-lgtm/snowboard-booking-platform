// NOT marked `server-only` (F-086g): scripts/send-test-email.ts imports this
// chain under plain Node via tsx, where the real package throws. The booking
// senders that wrap this module are marked instead.
import { Resend, type CreateEmailOptions } from "resend";
import { canUseConsoleEmail, getEmailConfig } from "./config";

type ResendSendResponse = Awaited<ReturnType<Resend["emails"]["send"]>>;

export type EmailSendResult = {
  id: string;
};

export type EmailClient = {
  emails: {
    send: (
      payload: CreateEmailOptions,
      options?: Parameters<Resend["emails"]["send"]>[1],
    ) => Promise<ResendSendResponse>;
  };
};

export type SendEmailInput = Omit<CreateEmailOptions, "from"> & {
  from?: string;
};

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

const resendClients = new Map<string, Resend>();

function getResendClient(apiKey: string): Resend {
  let client = resendClients.get(apiKey);
  if (!client) {
    client = new Resend(apiKey);
    resendClients.set(apiKey, client);
  }
  return client;
}

function formatResendError(error: ResendSendResponse["error"]): string {
  if (!error) {
    return "Unknown Resend error";
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return JSON.stringify(error);
}

export async function sendEmail(
  input: SendEmailInput,
  opts: {
    client?: EmailClient;
    env?: NodeJS.ProcessEnv;
    idempotencyKey?: string;
  } = {},
): Promise<EmailSendResult> {
  const env = opts.env ?? process.env;

  if (canUseConsoleEmail(env)) {
    console.info(`[email:dev] ${input.subject} → ${String(input.to)}`);
    return { id: "dev-email-disabled" };
  }

  const config = getEmailConfig(env);
  const client = opts.client ?? getResendClient(config.apiKey);
  const payload = {
    ...input,
    from: input.from ?? config.from,
    ...(input.replyTo || !config.replyTo ? {} : { replyTo: config.replyTo }),
  } as CreateEmailOptions;

  const response = await client.emails.send(
    payload,
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );

  if (response.error) {
    throw new EmailSendError(formatResendError(response.error));
  }

  if (!response.data?.id) {
    throw new EmailSendError("Resend did not return an email id");
  }

  return { id: response.data.id };
}
