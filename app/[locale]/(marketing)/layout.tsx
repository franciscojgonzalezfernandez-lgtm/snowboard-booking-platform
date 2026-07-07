import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLd } from "@/app/components/JsonLd";
import { SiteNav } from "@/app/components/SiteNav";
import { getSeasonPriceRange } from "@/lib/seo/price-range";
import { buildLocalBusiness } from "@/lib/seo/structured-data";

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

  const [tNav, priceRange] = await Promise.all([
    getTranslations("nav"),
    getSeasonPriceRange(),
  ]);

  // LocalBusiness / SportsActivityLocation on every marketing page (F-100) —
  // one canonical node (@id) for Knowledge Panel + rich results. No
  // aggregateRating yet: it stays gated until D-PLACE / real Google reviews.
  const localBusiness = buildLocalBusiness(
    priceRange ? { priceRange } : {},
  );

  return (
    <>
      <JsonLd data={localBusiness} />
      <SiteNav utility={tNav("utility")} />
      {children}
    </>
  );
}
