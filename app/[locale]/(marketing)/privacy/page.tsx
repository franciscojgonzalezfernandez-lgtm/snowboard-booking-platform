import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingAlternates } from "@/lib/seo/page-metadata";

import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/privacy", locale),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  return (
    <main
      data-testid="privacy-page"
      className="mx-auto max-w-2xl px-6 py-16 sm:py-24"
    >
      <header className="mb-12 space-y-3 border-b border-foreground/15 pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          {t("last_updated")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight sm:text-5xl"
          data-testid="privacy-heading"
        >
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="space-y-10">
        <section data-testid="privacy-section-controller">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_controller_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_controller_body")}
          </p>
        </section>

        <section data-testid="privacy-section-data">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_data_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_data_body")}
          </p>
        </section>

        <section data-testid="privacy-section-processors">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_processors_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_processors_body")}
          </p>
        </section>

        <section data-testid="privacy-section-retention">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_retention_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_retention_body")}
          </p>
        </section>

        <section data-testid="privacy-section-rights">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_rights_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_rights_body")}
          </p>
        </section>

        <section data-testid="privacy-section-contact">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">
            {t("section_contact_title")}
          </h2>
          <p className="leading-relaxed text-foreground/85">
            {t("section_contact_body")}
          </p>
        </section>
      </div>
    </main>
  );
}
