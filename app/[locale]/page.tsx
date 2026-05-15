import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteNav } from "@/app/components/SiteNav";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tHome = await getTranslations("home");

  return (
    <>
      <SiteNav utility={tHome("utility")} />

      {/* hero: full-bleed Unsplash photo + editorial overlay.
          D-LOGO / D-PHOTO blockers track owner's real photography for Sprint 5. */}
      <section className="relative h-[86vh] min-h-[600px] max-h-[880px] overflow-hidden bg-foreground text-background">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-[0.78]"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=2400&q=80)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,8,0.78)] via-[rgba(20,14,8,0.1)] to-[rgba(20,14,8,0.55)]"
        />

        <div className="relative flex h-full flex-col justify-end px-7 pb-14 pt-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="mb-7 inline-flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.28em] text-background">
              <span className="block h-[2px] w-12 bg-primary" aria-hidden></span>
              <span>{tHome("eyebrow")}</span>
            </div>

            <h1 className="mb-6 max-w-[14ch] text-balance font-display text-[clamp(48px,9.5vw,132px)] leading-[0.9] tracking-[-0.02em] uppercase">
              {tHome("title_line1")}
              <br />
              {tHome("title_line2_pre") ? (
                <>{tHome("title_line2_pre")} </>
              ) : null}
              <span className="text-primary">{tHome("title_accent")}.</span>
            </h1>

            <p className="mb-9 max-w-[560px] text-lg leading-[1.45] text-background/85">
              {tHome("sub")}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reservar"
                className="rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-destructive hover:border-destructive"
              >
                {tHome("cta_primary")}
              </Link>
              <Link
                href="/login"
                className="rounded-md border-2 border-background bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-background hover:text-foreground"
              >
                {tHome("cta_signin")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-foreground bg-foreground text-background">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-7 py-12 text-[11px] font-bold uppercase tracking-[0.2em]">
          <span>{tHome("footer_copy")}</span>
          <span>{tHome("footer_loc")}</span>
          <span>
            EN <span className="text-primary">·</span> DE{" "}
            <span className="text-primary">·</span> ES
          </span>
        </div>
      </footer>
    </>
  );
}
