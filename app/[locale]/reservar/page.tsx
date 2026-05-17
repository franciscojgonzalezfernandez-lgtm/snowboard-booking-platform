import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { Step1FiltersForm } from "./step1-filters-form";

type ReservarPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: ReservarPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.step1" });
  return { title: t("metadata_title") };
}

export default async function ReservarPage({ params }: ReservarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "reservar.step1" });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2">
        <p
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
          data-testid="step-eyebrow"
        >
          {t("eyebrow")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight"
          data-testid="step1-title"
        >
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </div>

      <div className="mt-10">
        <Step1FiltersForm locale={locale} />
      </div>
    </main>
  );
}
