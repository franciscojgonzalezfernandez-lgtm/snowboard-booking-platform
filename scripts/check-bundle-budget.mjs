#!/usr/bin/env node
// F-125 — fails the build when the home ships more JS than the performance
// budget in CLAUDE.md allows (First Load JS < 200 KB gzipped).
//
// Why a script and not a Lighthouse assertion: this catches the regression at
// the point it is introduced (a stray `import` in a shared client island) and
// costs one `next build`, which CI already runs. Lighthouse tells you the home
// got slower a week later and makes you bisect for the import.
//
// The number is the gzipped sum of every chunk the route loads, per
// `.next/app-build-manifest.json` — the same set Next.js totals as "First Load
// JS" in its build output. Expect it to read a few KB under Next's figure:
// Next also counts the build manifest scripts, which are not route chunks.
//
// Two modes:
//   node scripts/check-bundle-budget.mjs                  after `npm run build`
//   node scripts/check-bundle-budget.mjs --url https://…  against a deployment
//
// The local mode cannot run on PR CI: `next build` prerenders marketing pages
// that read Postgres through the Neon serverless driver, and CI has no database
// (a plain `postgres:` service container does not speak the Neon WebSocket
// protocol). Until CI gets a Neon branch — F-022 — the PR-time guard is the
// local one, and the automated guard is `--url` against the production
// deployment in post-deploy-smoke.yml.
//
// Both modes gzip the bytes themselves at level 9 rather than trusting
// `content-length`, so a CDN switching between gzip and brotli cannot move the
// number and the two modes stay comparable.

import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = ".next";

// Route key in app-build-manifest.json → budget in KB gzipped.
const BUDGETS = [
  {
    label: "home (marketing)",
    route: "/(site)/[locale]/(marketing)/page",
    budgetKb: 200,
  },
];

function gzippedSizeOf(files) {
  let total = 0;
  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    total += gzipSync(readFileSync(join(NEXT_DIR, file)), { level: 9 }).length;
  }
  return total;
}

async function measureDeployedHome(baseUrl) {
  const homeUrl = new URL("/en", baseUrl).href;
  const res = await fetch(homeUrl);

  if (!res.ok) {
    throw new Error(`${homeUrl} answered ${res.status}`);
  }

  const html = await res.text();

  // Skip `noModule` scripts: that is Next's legacy polyfill bundle (~39 KB gz),
  // which no browser we target ever downloads. Next leaves it out of its own
  // "First Load JS" figure for the same reason, and skipping it here is what
  // keeps the two modes of this script comparable.
  const paths = [
    ...new Set(
      [...html.matchAll(/<script\b[^>]*>/gi)]
        .filter((tag) => !/\bnomodule\b/i.test(tag[0]))
        .flatMap((tag) => tag[0].match(/\/_next\/static\/[^"']+?\.js/) ?? []),
    ),
  ];

  if (paths.length === 0) {
    throw new Error(`no /_next/static chunks found in ${homeUrl}`);
  }

  let total = 0;
  for (const path of paths) {
    const chunk = await fetch(new URL(path, baseUrl).href);
    if (!chunk.ok) throw new Error(`${path} answered ${chunk.status}`);
    total += gzipSync(Buffer.from(await chunk.arrayBuffer()), {
      level: 9,
    }).length;
  }

  return { kb: total / 1024, count: paths.length };
}

function overBudget(label, kb, budgetKb, detail) {
  const ok = kb <= budgetKb;
  console.log(
    `${ok ? "✓" : "✗"} ${label}: ${kb.toFixed(1)} KB gz of JS ` +
      `(budget ${budgetKb} KB${detail ? `, ${detail}` : ""})`,
  );

  if (!ok) {
    console.error(
      `  Over budget by ${(kb - budgetKb).toFixed(1)} KB. Find the new import ` +
        `with \`npx @next/bundle-analyzer\`, or move it behind a dynamic import ` +
        `the way MobileNav/NavMore/AuthNav do.`,
    );
  }

  return !ok;
}

const urlFlag = process.argv.indexOf("--url");
const baseUrl = urlFlag === -1 ? null : process.argv[urlFlag + 1];
let failed = false;

if (baseUrl) {
  const { budgetKb, label } = BUDGETS[0];
  try {
    const { kb, count } = await measureDeployedHome(baseUrl);
    failed = overBudget(`${label} @ ${baseUrl}`, kb, budgetKb, `${count} chunks`);
  } catch (error) {
    console.error(`✗ could not measure ${baseUrl}: ${error.message}`);
    failed = true;
  }
} else {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"),
    );
  } catch {
    console.error(
      "✗ .next/app-build-manifest.json not found — run `npm run build` first.",
    );
    process.exit(1);
  }

  for (const { label, route, budgetKb } of BUDGETS) {
    const files = manifest.pages[route];

    if (!files) {
      console.error(
        `✗ ${label}: route "${route}" is not in the build manifest. If the ` +
          `route moved, update BUDGETS in this script — do not delete the check.`,
      );
      failed = true;
      continue;
    }

    failed =
      overBudget(label, gzippedSizeOf(files) / 1024, budgetKb) || failed;
  }
}

process.exit(failed ? 1 : 0);
