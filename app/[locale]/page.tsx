import { setRequestLocale } from "next-intl/server";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

// F-031 stub. F-032 replaces this with the real home (hero + CTA + LanguageSwitcher).
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Locale · {locale}
      </p>
      <h1 className="mt-3 text-4xl">Home placeholder</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        next-intl scaffolding (F-031). The real home lands in F-032 with hero,
        booking CTA, sign-in link and language switcher.
      </p>
    </main>
  );
}
