#!/usr/bin/env node
/**
 * `npm run dev` orchestrator.
 *
 * Goal: developer runs one command, both Next.js dev server AND `stripe
 * listen --forward-to localhost:3000/api/webhooks/stripe` come up, and
 * `STRIPE_WEBHOOK_SECRET` in `.env.local` is kept in sync with whatever
 * `stripe listen --print-secret` reports (stable per machine+account, not
 * per session — confirmed against Stripe CLI docs).
 *
 * Fail-soft: if the Stripe CLI is not installed or the user is not logged
 * in, the script warns and starts just `next dev`. This keeps CI (which
 * runs `npm run dev` under Playwright) green without an extra `stripe`
 * dependency on the runner.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LOCAL = resolve(process.cwd(), ".env.local");
const SECRET_KEY = "STRIPE_WEBHOOK_SECRET";
const WEBHOOK_FORWARD = "localhost:3000/api/webhooks/stripe";

const RESET = "\x1b[0m";
function log(tag, color, line) {
  process.stdout.write(`${color}[${tag}]${RESET} ${line}\n`);
}

function stripeCliAvailable() {
  const probe = spawnSync("stripe", ["--version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

function fetchWebhookSecret() {
  const res = spawnSync("stripe", ["listen", "--print-secret"], {
    encoding: "utf8",
  });
  if (res.status !== 0) {
    return { ok: false, reason: res.stderr?.trim() || "exit-non-zero" };
  }
  const match = res.stdout.match(/whsec_[A-Za-z0-9]+/);
  if (!match) return { ok: false, reason: "could-not-parse-whsec" };
  return { ok: true, secret: match[0] };
}

function patchEnvLocal(secret) {
  const line = `${SECRET_KEY}=${secret}`;
  let content = existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, "utf8") : "";
  const re = new RegExp(`^${SECRET_KEY}=.*$`, "m");

  if (re.test(content)) {
    const existing = content.match(re)[0];
    if (existing === line) return "unchanged";
    content = content.replace(re, line);
  } else {
    content += (content === "" || content.endsWith("\n") ? "" : "\n") + line + "\n";
  }
  writeFileSync(ENV_LOCAL, content);
  return "written";
}

function spawnPiped(tag, color, cmd, args) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  const writeLines = (buf) => {
    for (const raw of buf.toString().split(/\r?\n/)) {
      if (raw.length > 0) log(tag, color, raw);
    }
  };
  child.stdout.on("data", writeLines);
  child.stderr.on("data", writeLines);
  return child;
}

const cyan = "\x1b[36m";
const magenta = "\x1b[35m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";

let stripeReady = false;
if (stripeCliAvailable()) {
  const result = fetchWebhookSecret();
  if (result.ok) {
    const outcome = patchEnvLocal(result.secret);
    log(
      "dev",
      cyan,
      outcome === "written"
        ? `STRIPE_WEBHOOK_SECRET synced to .env.local (${result.secret.slice(0, 12)}…)`
        : `STRIPE_WEBHOOK_SECRET already current in .env.local`,
    );
    stripeReady = true;
  } else {
    log(
      "dev",
      yellow,
      `Stripe CLI present but could not fetch secret (${result.reason}). Run \`stripe login\` once. Continuing without webhook forwarding.`,
    );
  }
} else {
  log(
    "dev",
    yellow,
    "Stripe CLI not installed (skipping webhook forwarding). Install with `brew install stripe/stripe-cli/stripe`.",
  );
}

const children = [];
const next = spawnPiped("next", magenta, "next", ["dev", "--turbopack"]);
children.push(next);

if (stripeReady) {
  const stripeChild = spawnPiped("stripe", yellow, "stripe", [
    "listen",
    "--forward-to",
    WEBHOOK_FORWARD,
  ]);
  children.push(stripeChild);
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) c.kill("SIGINT");
  }
  setTimeout(() => process.exit(code), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const c of children) {
  c.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log(
      "dev",
      red,
      `child exited (code=${code} signal=${signal}). Tearing down siblings.`,
    );
    shutdown(code ?? 1);
  });
}
