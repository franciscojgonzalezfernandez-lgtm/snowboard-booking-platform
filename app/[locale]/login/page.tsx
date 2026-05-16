import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LoginPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metadata_title") };
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations({ locale, namespace: "login" });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-4xl tracking-tight" data-testid="login-title">
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </div>

      <div className="mt-10">
        <LoginForm locale={locale} />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        {t("terms_prefix")}
        <Link
          href={`/${locale}`}
          className="underline-offset-4 hover:underline"
        >
          {t("terms_link")}
        </Link>
        {t("terms_suffix")}
      </p>
    </main>
  );
}
