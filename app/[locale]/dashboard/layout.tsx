import { setRequestLocale } from "next-intl/server";

import { SiteNav } from "@/app/components/SiteNav";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Authenticated chrome. Middleware + page-level auth gate already redirect
// anonymous visitors to /login, so SiteNav renders the My account + Sign out
// branch in steady state.
export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
