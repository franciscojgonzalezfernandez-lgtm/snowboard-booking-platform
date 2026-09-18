import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { marketingAlternates, marketingOpenGraph } from "@/lib/seo/page-metadata";

import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "impressum" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/impressum", locale),
    openGraph: marketingOpenGraph("/impressum", locale),
  };
}

export default async function ImpressumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "impressum" });

  const { address } = LEGAL_ENTITY;

  // Ordered identity rows. TWINT's onboarding rules require name + legal form,
  // full address and a contact to be visible in the legal notice; an Einzelfirma
  // must also name the proprietor.
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("label_company"), value: LEGAL_ENTITY.legalName },
    {
      label: t("label_legal_form"),
      value: `${LEGAL_ENTITY.legalForm} (${t("legal_form_gloss")})`,
    },
    { label: t("label_owner"), value: LEGAL_ENTITY.owner },
    {
      label: t("label_address"),
      value: (
        <span className="not-italic">
          {address.street}
          <br />
          {address.postalCode} {address.locality}
          <br />
          {t("country")}
        </span>
      ),
    },
    {
      label: t("label_email"),
      value: (
        <a
          href={`mailto:${LEGAL_ENTITY.email}`}
          className="underline underline-offset-4 hover:text-primary"
        >
          {LEGAL_ENTITY.email}
        </a>
      ),
    },
    {
      label: t("label_phone"),
      value: (
        <a
          href={`tel:${LEGAL_ENTITY.phoneTel}`}
          className="underline underline-offset-4 hover:text-primary"
        >
          {LEGAL_ENTITY.phoneDisplay}
        </a>
      ),
    },
  ];

  return (
    <main
      data-testid="impressum-page"
      className="mx-auto max-w-2xl px-6 py-16 sm:py-24"
    >
      <header className="mb-12 space-y-3 border-b border-foreground/15 pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          {t("last_updated")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight sm:text-5xl"
          data-testid="impressum-heading"
        >
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("intro")}</p>
      </header>

      <dl
        data-testid="impressum-identity"
        className="divide-y divide-foreground/10 border-y border-foreground/15"
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
          >
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {row.label}
            </dt>
            <dd className="leading-relaxed text-foreground/85">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
        {t("vat_note")}
      </p>
    </main>
  );
}
