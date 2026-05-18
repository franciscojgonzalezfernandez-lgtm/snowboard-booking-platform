import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

type Step3PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ duration?: string; date?: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Step3Page({
  params,
  searchParams,
}: Step3PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { duration = "", date = "" } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p
        className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        data-testid="step3-eyebrow"
      >
        Step 3 of 4 · Time + instructor
      </p>
      <h1
        className="mt-2 font-display text-4xl tracking-tight"
        data-testid="step3-title"
      >
        Placeholder
      </h1>
      <dl className="mt-8 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Duration</dt>
        <dd data-testid="step3-duration">{duration}</dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd data-testid="step3-date">{date}</dd>
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">
        Anchor times, instructor cards and class language land in F-027.
      </p>
    </main>
  );
}
