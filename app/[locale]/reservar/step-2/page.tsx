import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

type Step2PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ duration?: string; language?: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ReservarStep2Page({
  params,
  searchParams,
}: Step2PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { duration = "", language = "" } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p
        className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        data-testid="step2-eyebrow"
      >
        Step 2 of 4 · Calendar
      </p>
      <h1
        className="mt-2 font-display text-4xl tracking-tight"
        data-testid="step2-title"
      >
        Placeholder
      </h1>
      <dl className="mt-8 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Duration</dt>
        <dd data-testid="step2-duration">{duration}</dd>
        <dt className="text-muted-foreground">Language</dt>
        <dd data-testid="step2-language">{language}</dd>
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">
        The smart calendar lands in F-026.
      </p>
    </main>
  );
}
