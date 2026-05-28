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
import { DashboardTabs, type DashboardTab } from "./_components/dashboard-tabs";
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

  // Tab order: Upcoming → Pending → Past → Cancelled. Pending is exceptional —
  // only offered when at least one PENDING_PAYMENT row falls inside the
  // 15-minute resume window; otherwise the tab would be permanent noise (95% of
  // bookers never abandon checkout).
  const tabKinds: SectionKind[] = [
    "upcoming",
    ...(groups.pending.length > 0 ? (["pending"] as const) : []),
    "past",
    "cancelled",
  ];

  const tabs: DashboardTab[] = tabKinds.map((kind) => {
    const count = groups[kind].length;
    const label = t(`section_${kind}`);
    return {
      kind,
      label,
      count,
      ariaLabel: t("tab_count_label", { label, count }),
      content: (
        <DashboardSection
          kind={kind}
          bookings={groups[kind]}
          creditsBySource={creditsBySource}
          locale={locale}
          t={t}
          tStep1={tStep1}
        />
      ),
    };
  });

  // Land on the most actionable view: the next class if any, else a resumable
  // draft, else (for a historical booker with no future activity) their Past
  // history. A brand-new account with nothing falls back to Upcoming so the
  // "Book a lesson" CTA stays in front of them. URL `?tab=` overrides this.
  const defaultTab: SectionKind =
    groups.upcoming.length > 0
      ? "upcoming"
      : groups.pending.length > 0
        ? "pending"
        : groups.past.length > 0
          ? "past"
          : "upcoming";

  const hasCredits = activeCredits.length > 0;

  const content = (
    <>
      <DashboardTabs tabs={tabs} defaultTab={defaultTab} />

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
