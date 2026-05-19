import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Step4Form } from "./step4-form";

type Step4SearchParams = {
  duration?: string;
  date?: string;
  time?: string;
  instructor?: string;
  language?: string;
};

type Step4PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Step4SearchParams>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Step4PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "reservar.step4",
  });
  return { title: t("metadata_title") };
}

function buildLoginNext(locale: string, sp: Step4SearchParams): string {
  const qs = new URLSearchParams();
  if (sp.duration) qs.set("duration", sp.duration);
  if (sp.date) qs.set("date", sp.date);
  if (sp.time) qs.set("time", sp.time);
  if (sp.instructor) qs.set("instructor", sp.instructor);
  if (sp.language) qs.set("language", sp.language);
  const query = qs.toString();
  return `/${locale}/reservar/step-4${query ? `?${query}` : ""}`;
}

export default async function Step4Page({
  params,
  searchParams,
}: Step4PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const t = await getTranslations({
    locale,
    namespace: "reservar.step4",
  });

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    const next = buildLoginNext(locale, sp);
    const loginHref = `/login?next=${encodeURIComponent(next)}`;
    return (
      <main
        data-testid="step4-anonymous"
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16"
      >
        <p
          data-testid="step4-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="step4-anonymous-heading"
          className="mt-2 font-display text-4xl tracking-tight"
        >
          {t("anonymous_heading")}
        </h1>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("anonymous_body")}
        </p>
        <div className="mt-8">
          <Link
            href={loginHref}
            data-testid="step4-anonymous-cta"
            className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
          >
            {t("anonymous_cta")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="step4-page"
      className="mx-auto max-w-2xl px-6 py-12 sm:py-16"
    >
      <header className="space-y-2">
        <p
          data-testid="step4-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="step4-title"
          className="font-display text-4xl tracking-tight"
        >
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </header>

      <div className="mt-10">
        <Step4Form
          locale={locale}
          bookerEmail={session.user.email ?? ""}
          bookerName={session.user.name ?? ""}
          duration={sp.duration ?? ""}
          date={sp.date ?? ""}
          time={sp.time ?? ""}
          instructor={sp.instructor ?? ""}
          language={sp.language ?? ""}
        />
      </div>
    </main>
  );
}
