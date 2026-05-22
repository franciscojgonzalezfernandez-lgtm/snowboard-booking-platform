import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Duration } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";
import { decodeAttendees } from "@/lib/schemas/step4";
import { createBookingDraft } from "../actions";
import { Step5Payment } from "./step5-payment";

type Step5SearchParams = {
  duration?: string;
  date?: string;
  time?: string;
  instructor?: string;
  language?: string;
  bookerName?: string;
  bookerPhone?: string;
  attendees?: string;
  notes?: string;
};

type Step5PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Step5SearchParams>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Step5PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.step5" });
  return { title: t("metadata_title") };
}

const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

function isDuration(value: string | undefined): value is Duration {
  return (
    value === "ONE_HOUR" ||
    value === "TWO_HOURS" ||
    value === "INTENSIVE" ||
    value === "FULL_DAY"
  );
}

function formatDateForLocale(dateIso: string, locale: string): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const tag = locale === "en" ? "en-CH" : locale === "de" ? "de-CH" : "es-CH";
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildOwnUrl(sp: Step5SearchParams, locale: string): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value) qs.set(key, value);
  }
  const q = qs.toString();
  return `/${locale}/reservar/step-5${q ? `?${q}` : ""}`;
}

function ErrorPanel({
  title,
  body,
  cta,
  href,
  testid,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  testid: string;
}) {
  return (
    <main
      data-testid={testid}
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16"
    >
      <h1 className="font-display text-4xl tracking-tight">{title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>
      <Link
        href={href}
        className="mt-8 inline-flex items-center justify-center self-start rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
      >
        {cta}
      </Link>
    </main>
  );
}

export default async function Step5Page({
  params,
  searchParams,
}: Step5PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "reservar.step5" });

  if (
    !isDuration(sp.duration) ||
    !sp.date ||
    !sp.time ||
    !sp.instructor ||
    !sp.language ||
    !sp.bookerName ||
    !sp.bookerPhone ||
    !sp.attendees
  ) {
    return (
      <ErrorPanel
        title={t("error_invalid_title")}
        body={t("error_invalid_body")}
        cta={t("error_invalid_cta")}
        href={`/${locale}/reservar/step-4`}
        testid="step5-error-invalid"
      />
    );
  }

  let attendees: ReturnType<typeof decodeAttendees>;
  try {
    attendees = decodeAttendees(sp.attendees);
  } catch {
    return (
      <ErrorPanel
        title={t("error_invalid_title")}
        body={t("error_invalid_body")}
        cta={t("error_invalid_cta")}
        href={`/${locale}/reservar/step-4`}
        testid="step5-error-invalid"
      />
    );
  }

  const draft = await createBookingDraft({
    date: sp.date,
    time: sp.time,
    duration: sp.duration,
    instructorId: sp.instructor,
    language: sp.language as never,
    bookerName: sp.bookerName,
    bookerPhone: sp.bookerPhone,
    attendees,
    notes: sp.notes ?? "",
    acceptedTerms: true,
  });

  if (!draft.ok) {
    switch (draft.error) {
      case "UNAUTHORIZED": {
        const next = buildOwnUrl(sp, locale);
        redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
      }
      case "SLOT_TAKEN":
        return (
          <ErrorPanel
            title={t("error_slot_taken_title")}
            body={t("error_slot_taken_body")}
            cta={t("error_slot_taken_cta")}
            href={`/reservar/step-2?duration=${sp.duration}`}
            testid="step5-error-slot-taken"
          />
        );
      case "PRICING_MISSING":
      case "NO_ACTIVE_SEASON":
        return (
          <ErrorPanel
            title={t("error_pricing_title")}
            body={t("error_pricing_body")}
            cta={t("error_pricing_cta")}
            href="/reservar"
            testid="step5-error-pricing"
          />
        );
      case "INVALID_INPUT":
      default:
        return (
          <ErrorPanel
            title={t("error_invalid_title")}
            body={t("error_invalid_body")}
            cta={t("error_invalid_cta")}
            href="/reservar/step-4"
            testid="step5-error-invalid"
          />
        );
    }
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set — required for Step 5 Payment Element",
    );
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: sp.instructor },
    select: { user: { select: { name: true } } },
  });

  const tStep1 = await getTranslations({
    locale,
    namespace: "reservar.step1",
  });

  return (
    <main
      data-testid="step5-page"
      data-booking-id={draft.bookingId}
      className="mx-auto max-w-3xl px-6 py-12 sm:py-16"
    >
      <header className="space-y-2">
        <p
          data-testid="step5-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="step5-title"
          className="font-display text-4xl tracking-tight"
        >
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
        <aside
          data-testid="step5-summary"
          className="space-y-3 rounded-md border border-input p-5 text-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("summary_legend")}
          </p>
          <dl className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{t("summary_duration")}</dt>
              <dd
                className="font-medium"
                data-testid="step5-summary-duration"
              >
                {tStep1(DURATION_LABEL_KEY[sp.duration])}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{t("summary_date")}</dt>
              <dd className="font-medium" data-testid="step5-summary-date">
                {formatDateForLocale(sp.date, locale)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{t("summary_time")}</dt>
              <dd className="font-medium" data-testid="step5-summary-time">
                {sp.time}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("summary_instructor")}
              </dt>
              <dd
                className="font-medium"
                data-testid="step5-summary-instructor"
              >
                {instructor?.user.name ?? "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("summary_attendees")}
              </dt>
              <dd
                className="font-medium"
                data-testid="step5-summary-attendees"
              >
                {t("summary_attendees_count", { count: attendees.length })}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-input pt-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("summary_total")}
            </span>
            <span
              className="font-display text-2xl tracking-tight"
              data-testid="step5-summary-total"
            >
              {formatChf(draft.totalPriceCents)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("summary_vat_note")}
          </p>
        </aside>

        <Step5Payment
          locale={locale}
          publishableKey={publishableKey}
          clientSecret={draft.clientSecret}
          bookingId={draft.bookingId}
          totalLabel={formatChf(draft.totalPriceCents)}
        />
      </div>
    </main>
  );
}
