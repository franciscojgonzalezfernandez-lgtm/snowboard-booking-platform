import { setRequestLocale } from "next-intl/server";

import { SiteNav } from "@/app/components/SiteNav";
import { Toaster } from "@/components/ui/sonner";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Authenticated chrome. Middleware + page-level auth gate already redirect
// anonymous visitors to /login, so SiteNav renders the My account + Sign out
// branch in steady state. The sonner <Toaster /> is mounted here (not globally)
// so dashboard mutations can surface feedback toasts without adding client
// toast machinery to the public marketing routes.
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
      <Toaster />
    </>
  );
}
