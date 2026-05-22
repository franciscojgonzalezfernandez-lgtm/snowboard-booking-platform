import { setRequestLocale } from "next-intl/server";

import { BookingQueryProvider } from "./query-provider";
import { DraftGuardProvider } from "./draft-guard";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function ReservarLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <BookingQueryProvider>
      <DraftGuardProvider>{children}</DraftGuardProvider>
    </BookingQueryProvider>
  );
}
