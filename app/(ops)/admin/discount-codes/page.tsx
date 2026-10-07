import type { Metadata } from "next";

import { listDiscountCodesWith } from "@/lib/admin/discount-codes";
import { prisma } from "@/lib/db";

import { CreateDiscountCodeDialog } from "./_components/create-discount-code-dialog";
import { DiscountCodeRow } from "./_components/discount-code-row";

export const metadata: Metadata = {
  title: "Discount codes · Admin",
};

export default async function AdminDiscountCodesPage() {
  const codes = await listDiscountCodesWith({ prisma });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-input pb-8">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Discount codes
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Discount codes
          </h1>
          <p className="text-sm text-muted-foreground">
            Promo codes a booker can apply in the step before payment. Each code
            takes a percentage or a fixed CHF amount off the lesson, and every
            customer can use a given code once.
          </p>
        </div>
        <CreateDiscountCodeDialog />
      </header>

      <section data-testid="discount-codes-list" className="mt-2">
        {codes.length === 0 ? (
          <p
            data-testid="discount-codes-empty"
            className="py-12 text-sm text-muted-foreground"
          >
            No discount codes yet. Create one to start offering promotions.
          </p>
        ) : (
          codes.map((row) => <DiscountCodeRow key={row.id} row={row} />)
        )}
      </section>
    </div>
  );
}
