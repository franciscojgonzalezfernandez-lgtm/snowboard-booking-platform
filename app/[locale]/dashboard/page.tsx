import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

import {
  CreditAside,
  type ActiveCreditRow,
} from "./_components/credit-aside";
import { DashboardSection } from "./_components/dashboard-section";
import { PersonalPhoneField } from "./_components/personal-phone-field";
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
  const now = new Date();

  const [bookings, credits, activeCredits, account] = await Promise.all([
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
    prisma.accountCredit.findMany({
      where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
      select: {
        id: true,
        amountCents: true,
        expiresAt: true,
        createdAt: true,
      },
    }) as Promise<ActiveCreditRow[]>,
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

  const hasCredits = activeCredits.length > 0;

  const content = (
    <>
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
            <PersonalPhoneField initialPhone={account?.phone ?? null} />
          </div>
        </dl>
      </section>
    </>
  );

  return (
    <main
      data-testid="dashboard-page"
      className={cn(
        "mx-auto px-6 pb-24 pt-16 sm:pt-20",
        hasCredits ? "max-w-3xl lg:max-w-5xl" : "max-w-3xl",
      )}
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

      {hasCredits ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-12">
          <CreditAside
            credits={activeCredits}
            locale={locale}
            t={t}
            className="mb-10 lg:order-2 lg:mb-0 lg:sticky lg:top-24"
          />
          <div className="lg:order-1">{content}</div>
        </div>
      ) : (
        <>
          <p
            data-testid="dashboard-credits-empty"
            className="mt-4 text-sm text-muted-foreground"
          >
            {t("credits.empty")}
          </p>
          {content}
        </>
      )}
    </main>
  );
}
