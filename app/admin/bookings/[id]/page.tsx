import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CreditReason, CreditStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { OpsCancelButton } from "./_components/ops-cancel-button";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminTime,
} from "@/lib/admin/format";
import {
  CREDIT_REASON_LABEL,
  CREDIT_STATUS_LABEL,
  DURATION_LABEL,
  LANGUAGE_LABEL,
  LEVEL_LABEL,
  STATUS_LABEL,
} from "@/lib/labels/booking";
import {
  loadAdminBookingDetail,
  type AdminBookingDetailDeps,
} from "@/lib/admin/booking-detail";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

function detailDeps(): AdminBookingDetailDeps {
  return { prisma };
}

export const metadata: Metadata = {
  title: "Booking · Admin",
};

type Props = { params: Promise<{ id: string }> };

function birthDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CH", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await loadAdminBookingDetail(detailDeps(), { id });
  if (!result.ok) notFound();
  const b = result.booking;

  const showOpsCancel =
    b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT" || b.status === "COMPLETED";
  const showNoShow = b.status === "COMPLETED" && b.autoCompletedAt !== null;

  // Mirror the gating in `cancelBookingByOpsWith`: only money actually
  // captured earns a Stripe refund. PENDING_PAYMENT rows never paid.
  const cashRefundPreviewCents =
    b.status !== "PENDING_PAYMENT" &&
    b.paidAt !== null &&
    b.stripePaymentIntentId !== null
      ? (b.chargeAmountCents ?? b.totalPriceCents)
      : 0;
  const creditReEmitPreviewCents =
    b.status !== "PENDING_PAYMENT" ? (b.creditsAppliedCents ?? 0) : 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Booking
        </p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {formatAdminDate(b.date)} · {formatAdminTime(b.anchorTime)}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span data-testid="admin-booking-detail-status">{STATUS_LABEL[b.status]}</span>
          {" · "}
          {DURATION_LABEL[b.duration]} · {LANGUAGE_LABEL[b.language]}
        </p>
        <p className="text-xs text-muted-foreground">
          ID <code className="font-mono">{b.id}</code> · created{" "}
          {formatAdminDateTime(b.createdAt)}
        </p>
        <p>
          <Link
            href="/admin/bookings"
            className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            ← Back to bookings
          </Link>
        </p>
      </header>

      <Section title="Pricing">
        <Field label="Total">
          <span data-testid="admin-detail-total">{formatChf(b.totalPriceCents)}</span>
        </Field>
        <Field label="Credits applied">
          <span data-testid="admin-detail-credits-applied">
            {b.creditsAppliedCents && b.creditsAppliedCents > 0
              ? `−${formatChf(b.creditsAppliedCents)}`
              : "—"}
          </span>
        </Field>
        <Field label="Charged via Stripe">
          {b.chargeAmountCents !== null ? formatChf(b.chargeAmountCents) : "—"}
        </Field>
      </Section>

      <Section title="Booker">
        <Field label="Name">{b.booker.name ?? "—"}</Field>
        <Field label="Email">
          <span data-testid="admin-detail-booker-email">{b.booker.email}</span>
        </Field>
        <Field label="Phone">{b.booker.phone ?? "—"}</Field>
      </Section>

      <Section title="Instructor">
        <Field label="Name">{b.instructor.user.name ?? "—"}</Field>
        <Field label="Email">{b.instructor.user.email}</Field>
      </Section>

      <Section title={`Attendees (${b.attendees.length})`}>
        <ul className="space-y-3" data-testid="admin-detail-attendees">
          {b.attendees.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-input pb-3 last:border-0 last:pb-0"
              data-testid="admin-detail-attendee"
            >
              <span className="font-medium">{a.name}</span>
              {a.isBooker ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Booker
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {LEVEL_LABEL[a.level]} · DOB {birthDate(a.birthDate)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Payment">
        <Field label="Stripe PaymentIntent">
          <code className="break-all font-mono text-xs">
            {b.stripePaymentIntentId ?? "—"}
          </code>
        </Field>
        <Field label="Paid at">{formatAdminDateTime(b.paidAt)}</Field>
        <Field label="Refunded at">{formatAdminDateTime(b.refundedAt)}</Field>
        <Field label="Refund amount">
          {b.refundAmountCents !== null ? formatChf(b.refundAmountCents) : "—"}
        </Field>
        <Field label="Failure reason">{b.failureReason ?? "—"}</Field>
      </Section>

      <Section title="Credit ledger">
        <LedgerList
          heading="Issued from this booking"
          rows={b.creditsSourced}
          emptyTestId="admin-detail-credits-sourced-empty"
          rowTestId="admin-detail-credit-sourced"
        />
        <LedgerList
          heading="Applied to this booking"
          rows={b.creditsRedeemed}
          emptyTestId="admin-detail-credits-redeemed-empty"
          rowTestId="admin-detail-credit-redeemed"
        />
      </Section>

      <Section title="Audit">
        <Field label="Cancelled by user">{formatAdminDateTime(b.cancelledByUserAt)}</Field>
        <Field label="Cancelled by ops">{formatAdminDateTime(b.cancelledByOpsAt)}</Field>
        <Field label="Ops reason">{b.opsReason ?? "—"}</Field>
        <Field label="Auto-completed at">{formatAdminDateTime(b.autoCompletedAt)}</Field>
        <Field label="Confirmation email sent">
          {formatAdminDateTime(b.confirmationEmailSentAt)}
        </Field>
        <Field label="24h reminder sent">{formatAdminDateTime(b.reminder24hSentAt)}</Field>
        <Field label="Post-class email sent">
          {formatAdminDateTime(b.postClassEmailSentAt)}
        </Field>
        <Field label="Cancellation email sent">
          {formatAdminDateTime(b.cancellationEmailSentAt)}
        </Field>
        <Field label="ICS UID">
          <code className="break-all font-mono text-xs">{b.icsUid}</code>
        </Field>
        <Field label="Google event ID">
          <code className="break-all font-mono text-xs">{b.googleEventId ?? "—"}</code>
        </Field>
        <Field label="Booker notes">{b.notes ?? "—"}</Field>
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-3">
          {showOpsCancel ? (
            <OpsCancelButton
              bookingId={b.id}
              cashRefundPreviewCents={cashRefundPreviewCents}
              creditReEmitPreviewCents={creditReEmitPreviewCents}
            />
          ) : null}
          {showNoShow ? (
            <Button
              type="button"
              disabled
              title="Available in F-081"
              data-testid="admin-detail-action-no-show"
            >
              Mark no-show — F-081
            </Button>
          ) : null}
          {!showOpsCancel && !showNoShow ? (
            <p className="text-sm text-muted-foreground">
              No actions available for this booking status.
            </p>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-input py-8">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[14rem,1fr] sm:items-baseline">
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

type LedgerRow = {
  id: string;
  amountCents: number;
  reason: CreditReason;
  status: CreditStatus;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

function LedgerList({
  heading,
  rows,
  emptyTestId,
  rowTestId,
}: {
  heading: string;
  rows: LedgerRow[];
  emptyTestId: string;
  rowTestId: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {heading}
      </h3>
      {rows.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={emptyTestId}
        >
          None.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              data-testid={rowTestId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-input pb-2 last:border-0 last:pb-0 text-sm"
            >
              <span className="font-medium tabular-nums">{formatChf(r.amountCents)}</span>
              <span className="text-xs text-muted-foreground">
                {CREDIT_REASON_LABEL[r.reason]} ·{" "}
                {CREDIT_STATUS_LABEL[r.status]} · expires{" "}
                {formatAdminDateTime(r.expiresAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
