"use client";

import { useEffect, useMemo, useState } from "react";

import {
  LINK_PRESETS,
  buildUtmUrl,
  offlineCodeUrl,
} from "@/lib/attribution/campaign-link";

// Native <input>s on purpose: this builder recomputes the output URL live from
// controlled state, and the Base UI `components/ui/input` primitive does not
// reliably reflect a changing controlled `value` (the repo only ever uses it
// uncontrolled, via defaultValue / RHF). Styled to match that primitive.
const FIELD_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// F-156: in-panel cheat-sheet so the operator builds a correctly-tagged campaign
// URL without leaving the admin or hand-writing UTM params. Two parts: a small
// UTM builder for online channels (presets carry the source + medium that the
// capture layer classifies) and a ready-to-copy list of the offline `?c=` codes.
// The URL logic lives in lib/attribution/campaign-link.ts (unit-tested).

function CopyButton({ value, testId }: { value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (no permission / insecure context) — the URL is
          // still selectable in the field next to this button.
          setCopied(false);
        }
      }}
      className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CampaignLinkBuilder({
  knownCampaigns,
}: {
  knownCampaigns: Array<{ code: string; label: string }>;
}) {
  const [presetId, setPresetId] = useState(LINK_PRESETS[0]!.id);
  const [campaign, setCampaign] = useState("");
  const [hydrated, setHydrated] = useState(false);
  // Marks that onChange handlers are wired. Before hydration a filled value is
  // reset by React, so tests gate interaction on this; purely informational.
  useEffect(() => setHydrated(true), []);
  const preset = LINK_PRESETS.find((p) => p.id === presetId) ?? LINK_PRESETS[0]!;
  const url = useMemo(() => buildUtmUrl(preset, campaign), [preset, campaign]);

  return (
    <section
      className="space-y-8 rounded-lg border border-input p-6"
      data-testid="campaign-link-builder"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <div className="space-y-1">
        <h2 className="font-display text-xl tracking-tight">Build a campaign link</h2>
        <p className="text-sm text-muted-foreground">
          Tag a link so its bookings show up here. Pick a platform, name the
          campaign, copy the URL into the ad or QR code.
        </p>
      </div>

      {/* Online — UTM builder */}
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[14rem,1fr] sm:items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="builder-platform"
              className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
            >
              Platform
            </label>
            <select
              id="builder-platform"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              data-testid="campaign-builder-platform"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {LINK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="builder-campaign"
              className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
            >
              Campaign name (optional)
            </label>
            <input
              id="builder-campaign"
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="winter-promo"
              data-testid="campaign-builder-campaign"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            readOnly
            value={url}
            data-testid="campaign-builder-url"
            className={`${FIELD_CLASS} font-mono text-xs`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton value={url} testId="campaign-builder-copy" />
        </div>
      </div>

      {/* Offline — known QR codes */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Flyer / sticker QR codes
        </h3>
        <ul className="space-y-2" data-testid="campaign-codes">
          {knownCampaigns.map(({ code, label }) => {
            const codeUrl = offlineCodeUrl(code);
            return (
              <li
                key={code}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-input pb-2 last:border-0 last:pb-0"
              >
                <span className="min-w-[12rem] text-sm font-medium">{label}</span>
                <code className="flex-1 break-all font-mono text-xs text-muted-foreground">
                  {codeUrl}
                </code>
                <CopyButton value={codeUrl} />
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          New code? Add it to <code className="font-mono">lib/attribution/campaigns.ts</code>{" "}
          before printing its QR — an unlisted code is recorded as “Other”.
        </p>
      </div>
    </section>
  );
}
