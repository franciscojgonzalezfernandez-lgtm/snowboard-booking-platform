import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "terms" });

  return (
    <main
      data-testid="terms-page"
      className="mx-auto max-w-2xl px-6 py-16 sm:py-24"
    >
      <header className="mb-12 space-y-3 border-b border-foreground/15 pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          {t("last_updated")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight sm:text-5xl"
          data-testid="terms-heading"
        >
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="space-y-10">
        <section data-testid="terms-section-prices">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_prices_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_prices_body")}
          </p>
        </section>

        <section data-testid="terms-section-lessons">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_lessons_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_lessons_body")}
          </p>
        </section>

        <section data-testid="terms-section-insurance">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_insurance_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_insurance_body")}
          </p>
        </section>

        <section data-testid="terms-section-registration">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_registration_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_registration_body")}
          </p>
        </section>

        <section data-testid="terms-section-cancellation-customer">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_cancellation_customer_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_cancellation_customer_body")}
          </p>
          <p className="mt-3 border-l-2 border-primary pl-4 text-sm leading-relaxed text-foreground/75">
            {t("section_cancellation_customer_exception")}
          </p>
        </section>

        <section data-testid="terms-section-cancellation-school">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_cancellation_school_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_cancellation_school_body")}
          </p>
        </section>

        <section data-testid="terms-section-ski-tickets">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_ski_tickets_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_ski_tickets_body")}
          </p>
        </section>

        <section data-testid="terms-section-jurisdiction">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_jurisdiction_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_jurisdiction_body")}
          </p>
        </section>
      </div>
    </main>
  );
}
