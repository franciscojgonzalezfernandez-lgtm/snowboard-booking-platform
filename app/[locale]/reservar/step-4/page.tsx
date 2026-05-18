import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

type Step4PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    duration?: string;
    date?: string;
    time?: string;
    instructor?: string;
    language?: string;
  }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Step4Page({
  params,
  searchParams,
}: Step4PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    duration = "",
    date = "",
    time = "",
    instructor = "",
    language = "",
  } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p
        className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        data-testid="step4-eyebrow"
      >
        Step 4 of 4 · Booker + payment
      </p>
      <h1
        className="mt-2 font-display text-4xl tracking-tight"
        data-testid="step4-title"
      >
        Placeholder
      </h1>
      <dl className="mt-8 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Duration</dt>
        <dd data-testid="step4-duration">{duration}</dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd data-testid="step4-date">{date}</dd>
        <dt className="text-muted-foreground">Time</dt>
        <dd data-testid="step4-time">{time}</dd>
        <dt className="text-muted-foreground">Instructor</dt>
        <dd data-testid="step4-instructor">{instructor}</dd>
        <dt className="text-muted-foreground">Language</dt>
        <dd data-testid="step4-language">{language}</dd>
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">
        Attendees, T&amp;C, and Stripe Payment Element land in Sprint 2.
      </p>
    </main>
  );
}
