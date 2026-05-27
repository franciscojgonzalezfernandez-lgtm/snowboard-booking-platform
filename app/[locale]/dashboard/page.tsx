import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { DashboardSection } from "./_components/dashboard-section";
import {
  type BookingRow,
  type CreditRow,
  type SectionKind,
  groupBookings,
} from "./_lib/group";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metadata_title") };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/login?next=/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tStep1 = await getTranslations({
    locale,
    namespace: "reservar.step1",
  });

  const userId = session.user.id;

  const [bookings, credits, account] = await Promise.all([
    prisma.booking.findMany({
      where: { bookerId: userId },
      orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
      select: {
        id: true,
        date: true,
        anchorTime: true,
        duration: true,
        language: true,
        status: true,
        totalPriceCents: true,
        createdAt: true,
        cancelledByUserAt: true,
        cancelledByOpsAt: true,
        opsReason: true,
        refundedAt: true,
        refundAmountCents: true,
        instructor: { select: { user: { select: { name: true } } } },
      },
    }) as Promise<BookingRow[]>,
    prisma.accountCredit.findMany({
      where: { userId },
      select: {
        id: true,
        amountCents: true,
        sourceBookingId: true,
        expiresAt: true,
        status: true,
      },
    }) as Promise<CreditRow[]>,
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    }),
  ]);

  const groups = groupBookings(bookings);
  const creditsBySource = new Map<string, CreditRow>();
  for (const credit of credits) {
    creditsBySource.set(credit.sourceBookingId, credit);
  }

  const greetingName = account?.name?.trim().split(/\s+/)[0] ?? null;

  // Pending payment is exceptional — only render the section when at least one
  // PENDING_PAYMENT row falls inside the 15-minute window. Otherwise the
  // empty-state copy would be permanently visible noise (95% of bookers never
  // abandon checkout). The other three sections always render to give the
  // booker a stable mental model of their account.
  const SECTION_ORDER: SectionKind[] = [
    ...(groups.pending.length > 0 ? (["pending"] as const) : []),
    "upcoming",
    "past",
    "cancelled",
  ];

  return (
    <main
      data-testid="dashboard-page"
      className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-20"
    >
      <header className="space-y-3 border-b border-input pb-10">
        <p
          data-testid="dashboard-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="dashboard-heading"
          className="font-display text-4xl tracking-tight sm:text-5xl"
        >
          {greetingName
            ? t("heading_personal", { name: greetingName })
            : t("heading")}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t("sub")}
        </p>
      </header>

      {SECTION_ORDER.map((kind) => (
        <DashboardSection
          key={kind}
          kind={kind}
          bookings={groups[kind]}
          creditsBySource={creditsBySource}
          locale={locale}
          t={t}
          tStep1={tStep1}
        />
      ))}

      <section
        data-testid="dashboard-account"
        className="mt-16 border-t border-input pt-10"
      >
        <h2
          data-testid="dashboard-account-heading"
          className="font-display text-2xl tracking-tight"
        >
          {t("personal_heading")}
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-5 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_name")}
            </dt>
            <dd
              data-testid="dashboard-account-name"
              className="font-display text-lg tracking-tight"
            >
              {account?.name ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_email")}
            </dt>
            <dd
              data-testid="dashboard-account-email"
              className="break-all font-display text-lg tracking-tight"
            >
              {account?.email ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_phone")}
            </dt>
            <dd
              data-testid="dashboard-account-phone"
              className="font-display text-lg tracking-tight"
            >
              {account?.phone ?? (
                <span className="text-muted-foreground">
                  {t("personal_phone_missing")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
