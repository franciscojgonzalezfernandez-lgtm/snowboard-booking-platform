import { setRequestLocale } from "next-intl/server";

import { SiteNav } from "@/app/components/SiteNav";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Authenticated chrome. Middleware + page-level auth gate already redirect
// anonymous visitors to /login, so SiteNav renders the My account + Sign out
// branch in steady state. The sonner <Toaster /> is mounted globally in the
// root layout (app/layout.tsx) — mounting a second one here rendered every
// dashboard toast twice, so this layout deliberately has none.
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
