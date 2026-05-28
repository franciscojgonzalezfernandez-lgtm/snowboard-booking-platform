import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteNav } from "@/app/components/SiteNav";

type MarketingLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MarketingLayout({
  children,
  params,
}: MarketingLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations("nav");

  return (
    <>
      <SiteNav utility={tNav("utility")} />
      {children}
    </>
  );
}
