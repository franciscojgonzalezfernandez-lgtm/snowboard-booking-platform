import type { Metadata } from "next";
import { headers } from "next/headers";
import { BookingStatus } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";

type ExitoPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({
  params,
}: ExitoPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.exito" });
  return { title: t("metadata_title") };
}

export default async function ExitoPage({ params }: ExitoPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "reservar.exito" });
  const session = await auth.api.getSession({ headers: await headers() });

  const booking =
    session?.user && id
      ? await prisma.booking.findFirst({
          where: { id, bookerId: session.user.id },
          select: { id: true, status: true },
        })
      : null;

  const status = booking?.status ?? BookingStatus.PENDING_PAYMENT;
  const heading =
    status === BookingStatus.CONFIRMED || status === BookingStatus.COMPLETED
      ? t("heading_confirmed")
      : status === BookingStatus.PAYMENT_FAILED
        ? t("heading_failed")
        : t("heading_pending");
  const body =
    status === BookingStatus.CONFIRMED || status === BookingStatus.COMPLETED
      ? t("body_confirmed")
      : status === BookingStatus.PAYMENT_FAILED
        ? t("body_failed")
        : t("body_pending");

  return (
    <main
      data-testid="exito-page"
      data-status={status}
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16"
    >
      <p
        data-testid="exito-eyebrow"
        className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
      >
        {t("eyebrow")}
      </p>
      <h1
        data-testid="exito-heading"
        className="mt-2 font-display text-4xl tracking-tight"
      >
        {heading}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>

      <dl className="mt-8 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("booking_id_label")}</dt>
        <dd data-testid="exito-booking-id">{id}</dd>
      </dl>

      <Link
        href="/"
        data-testid="exito-back-home"
        className="mt-10 inline-flex items-center justify-center self-start rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
      >
        {t("back_home")}
      </Link>
    </main>
  );
}
