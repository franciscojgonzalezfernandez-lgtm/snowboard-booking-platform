import { setRequestLocale } from "next-intl/server";

import { BookingQueryProvider } from "./query-provider";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function ReservarLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BookingQueryProvider>{children}</BookingQueryProvider>;
}
