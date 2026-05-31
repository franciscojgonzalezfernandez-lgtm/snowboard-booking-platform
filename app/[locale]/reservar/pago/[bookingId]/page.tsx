import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resumePaymentWith } from "@/lib/booking/resume-payment";
import { getStripe } from "@/lib/stripe/server";
import { formatChf } from "@/lib/pricing/format";

import { PaymentBlock } from "../../payment-block";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.resume" });
  return { title: t("metadata_title") };
}

export default async function ResumePaymentPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/login?next=/${locale}/reservar/pago/${bookingId}`);
  }

  const t = await getTranslations({ locale, namespace: "reservar.resume" });

  const result = await resumePaymentWith(
    {
      prisma: prisma as unknown as Parameters<typeof resumePaymentWith>[0]["prisma"],
      stripe: getStripe(),
      bookerId: session.user.id,
    },
    bookingId,
  );

  if (!result.ok) {
    switch (result.error) {
      case "ALREADY_CONFIRMED":
        redirect(`/${locale}/reservar/exito/${bookingId}`);
      case "NOT_FOUND":
      case "FORBIDDEN":
      case "NOT_RESUMABLE":
      case "EXPIRED":
      case "STRIPE_BAD_STATE":
        redirect(`/${locale}/dashboard`);
    }
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set — required to mount the resume Payment Element.",
    );
  }

  return (
    <main
      data-testid="resume-payment-page"
      className="mx-auto max-w-xl px-6 pb-24 pt-16 sm:pt-20"
    >
      <header className="space-y-3 border-b border-input pb-8">
        <p
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
          data-testid="resume-eyebrow"
        >
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t("sub")}
        </p>
      </header>

      <section className="mt-10 space-y-6">
        {result.creditsAppliedCents > 0 && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p data-testid="resume-lesson-price">
              {t("lesson_price", {
                amount: formatChf(result.totalPriceCents),
              })}
            </p>
            <p data-testid="resume-credits-applied">
              {t("credits_applied", {
                amount: formatChf(result.creditsAppliedCents),
              })}
            </p>
          </div>
        )}
        <p
          data-testid="resume-total"
          className="font-display text-xl tracking-tight"
        >
          {t("total", { amount: formatChf(result.chargeAmountCents) })}
        </p>

        <PaymentBlock
          locale={locale}
          publishableKey={publishableKey}
          clientSecret={result.clientSecret}
          bookingId={result.bookingId}
          totalLabel={formatChf(result.chargeAmountCents)}
        />

        <p className="text-xs text-muted-foreground">{t("vat_note")}</p>
      </section>
    </main>
  );
}
