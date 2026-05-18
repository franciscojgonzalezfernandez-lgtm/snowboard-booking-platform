import { existsSync } from "node:fs";
import { sendTestEmail } from "../lib/email/send-test-email";

if (existsSync(".env.local")) {
  process.loadEnvFile?.(".env.local");
}

if (existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

const recipient = process.argv[2] ?? process.env.EMAIL_TEST_RECIPIENT;

if (!recipient) {
  throw new Error("Pass a recipient email or set EMAIL_TEST_RECIPIENT");
}

async function main() {
  const result = await sendTestEmail({ to: recipient });

  console.log(`Sent test email: ${result.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
