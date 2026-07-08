import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Reveal } from "@/lib/motion/reveal";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <main data-testid="about-page">
      {/* Hero — full-bleed owner portrait + editorial overlay. Square source, so
          crop biases up (object-[center_22%]) to keep face/hoodie in frame on
          wide viewports; the bottom gradient sits over the cropped legs where the
          heading reads. */}
      <section className="relative flex min-h-[68vh] items-end overflow-hidden bg-foreground text-background">
        <Image
          src="/brand/about.png"
          alt={t("hero_image_alt")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_42%] opacity-[0.85]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,8,0.82)] via-[rgba(20,14,8,0.15)] to-[rgba(20,14,8,0.45)]"
        />
        <div className="relative mx-auto w-full max-w-[1320px] px-6 pb-16 pt-24 lg:px-7">
          <p className="mb-6 inline-flex items-center gap-4 text-xs font-bold uppercase tracking-[0.28em]">
            <span className="block h-[2px] w-12 bg-primary" aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 className="max-w-[16ch] text-balance font-display text-[clamp(34px,6.5vw,84px)] leading-[0.95] tracking-tight">
            {t.rich("heading", {
              name: (chunks) => <span className="text-primary">{chunks}</span>,
            })}
          </h1>
          <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-background/85">
            {t("lede")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[820px] space-y-24 px-6 py-24 lg:px-7">
        <Reveal className="space-y-6">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("me_title")}
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80">
            {t("me_body_1")}
          </p>
          <p className="text-lg leading-relaxed text-foreground/80">
            {t("me_body_2")}
          </p>

          {/* D-VIDEO blocker: owner drops the real riding clip at
              /public/about/javi-riding.mp4. Until then the poster carries it.
              ponytail: native <video>, no player lib — controls + poster is the
              whole feature. */}
          <figure className="space-y-3 pt-2">
            <video
              data-testid="about-video"
              controls
              preload="none"
              playsInline
              poster="https://images.unsplash.com/photo-1605540436563-5bca919ae766?auto=format&fit=crop&w=1600&q=80"
              className="aspect-video w-full border border-foreground/15 bg-foreground/5 object-cover"
            >
              <source src="/about/javi-riding.mp4" type="video/mp4" />
            </video>
            <figcaption className="text-sm text-muted-foreground">
              {t("video_caption")}
            </figcaption>
          </figure>
        </Reveal>

        <Reveal className="space-y-5">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("philosophy_title")}
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80">
            {t("philosophy_body")}
          </p>
        </Reveal>

        <Reveal className="space-y-5">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("mountain_title")}
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80">
            {t("mountain_body")}
          </p>
        </Reveal>

        <Reveal className="border-t border-foreground/15 pt-12">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
            {t("cta_title")}
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/reservar"
              data-testid="about-cta-book"
              className="rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:border-destructive hover:bg-destructive"
            >
              {t("cta_book")}
            </Link>
            <Link
              href="/instructores"
              data-testid="about-cta-instructors"
              className="rounded-md border-2 border-foreground bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              {t("cta_instructors")}
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
