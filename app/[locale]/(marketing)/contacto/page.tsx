import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { Reveal } from "@/lib/motion/reveal";
import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";
import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from "@/lib/contact/email";
import {
  MEETING_POINT_MAPS_EMBED_SRC,
  MEETING_POINT_MAPS_HREF,
} from "@/lib/contact/location";
import { MapEmbed } from "./_components/map-embed";

type Props = { params: Promise<{ locale: string }> };

// Static contact info — phone/email constants + a click-to-load Google map. No
// DB, no per-request work, so prerender for every locale and keep it on the SSG
// path (the map iframe only mounts client-side after the visitor opts in).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });

  return (
    <main
      data-testid="contact-page"
      className="mx-auto max-w-[1100px] px-7 py-16 sm:py-24"
    >
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
        <section className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2">
          <div className="bg-background p-8">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("phone_label")}
            </p>
            <a
              href={`tel:${OPERATIONAL_PHONE_TEL}`}
              data-testid="contact-phone"
              className="mt-3 block font-display text-2xl tracking-tight transition-colors hover:text-primary sm:text-3xl"
            >
              {OPERATIONAL_PHONE_DISPLAY}
            </a>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              {t("phone_help")}
            </p>
          </div>

          <div className="bg-background p-8">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("email_label")}
            </p>
            <a
              href={CONTACT_EMAIL_HREF}
              data-testid="contact-email"
              className="mt-3 block break-words font-display text-2xl tracking-tight transition-colors hover:text-primary sm:text-3xl"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              {t("email_help")}
            </p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-12 grid gap-10 sm:grid-cols-2">
          <div
            data-testid="contact-hours"
            className="border-l-2 border-primary pl-5"
          >
            <h2 className="text-sm font-bold uppercase tracking-[0.2em]">
              {t("hours_label")}
            </h2>
            <p className="mt-3 font-display text-xl tracking-tight">
              {t("hours_value")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              {t("hours_note")}
            </p>
          </div>

          <div
            data-testid="contact-meeting"
            className="border-l-2 border-primary pl-5"
          >
            <h2 className="text-sm font-bold uppercase tracking-[0.2em]">
              {t("meeting_label")}
            </h2>
            <p className="mt-3 font-display text-xl tracking-tight">
              {t("meeting_value")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              {t("meeting_note")}
            </p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-16 border-t border-foreground/15 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight">
              {t("map_label")}
            </h2>
            <a
              href={MEETING_POINT_MAPS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="contact-map-link"
              className="text-[12px] font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:text-primary"
            >
              {t("map_link")}
            </a>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/70">
            {t("map_caption")}
          </p>
          <MapEmbed
            src={MEETING_POINT_MAPS_EMBED_SRC}
            title={t("map_aria")}
            loadLabel={t("map_load")}
            privacyNote={t("map_privacy")}
          />
        </section>
      </Reveal>
    </main>
  );
}
