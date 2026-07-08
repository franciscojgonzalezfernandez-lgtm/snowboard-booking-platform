import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingAlternates } from "@/lib/seo/page-metadata";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Reveal } from "@/lib/motion/reveal";
import { JsonLd } from "@/app/components/JsonLd";
import { buildFaqPage } from "@/lib/seo/structured-data";
import { FaqAccordion, type FaqItem } from "./faq-accordion";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/faq", locale),
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "faq" });

  const items = t.raw("items") as FaqItem[];

  return (
    <main
      data-testid="faq-page"
      className="mx-auto max-w-[820px] px-6 py-16 sm:py-24 lg:px-7"
    >
      {/* FAQPage JSON-LD built from the same `faq.items` the accordion renders,
          so structured data can never drift from the visible answers. */}
      <JsonLd data={buildFaqPage(items)} />

      <Reveal>
        <header className="mb-12 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.28em]">
            <span className="block h-[2px] w-12 bg-primary" aria-hidden></span>
            <span>{t("eyebrow")}</span>
          </div>
          <h1 className="font-display text-[clamp(34px,6vw,68px)] leading-[0.95] tracking-[-0.02em]">
            {t("heading")}
          </h1>
          <p className="mt-6 text-lg leading-[1.5] text-foreground/80">
            {t("intro")}
          </p>
        </header>
      </Reveal>

      <Reveal>
        <FaqAccordion items={items} />
      </Reveal>

      <Reveal>
        <section
          data-testid="faq-cta"
          className="mt-16 border-t border-foreground/15 pt-10"
        >
          <h2 className="font-display text-2xl tracking-tight">
            {t("cta_title")}
          </h2>
          <p className="mt-3 max-w-md text-foreground/75">{t("cta_body")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/reservar"
              data-testid="faq-cta-book"
              className="rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:border-destructive hover:bg-destructive"
            >
              {t("cta_book")}
            </Link>
            <Link
              href="/precios"
              data-testid="faq-cta-prices"
              className="rounded-md border-2 border-foreground bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              {t("cta_prices")}
            </Link>
            <Link
              href="/contacto"
              data-testid="faq-cta-contact"
              className="rounded-md border-2 border-foreground/30 bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
            >
              {t("cta_contact")}
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
