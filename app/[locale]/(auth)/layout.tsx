import { setRequestLocale } from "next-intl/server";

import { SiteNav } from "@/app/components/SiteNav";

type AuthLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Auth chrome — same SiteNav as marketing but without the utility bar so the
// brand row reads quieter on credential-entry pages.
export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
