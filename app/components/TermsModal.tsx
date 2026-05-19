"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Variant = "terms" | "privacy";

type SectionRow = {
  key: string;
  exceptionKey?: string;
};

const TERMS_SECTIONS: SectionRow[] = [
  { key: "prices" },
  { key: "lessons" },
  { key: "insurance" },
  { key: "registration" },
  { key: "cancellation_customer", exceptionKey: "cancellation_customer_exception" },
  { key: "cancellation_school" },
  { key: "ski_tickets" },
  { key: "jurisdiction" },
];

const PRIVACY_SECTIONS: SectionRow[] = [
  { key: "controller" },
  { key: "data" },
  { key: "processors" },
  { key: "retention" },
  { key: "rights" },
  { key: "contact" },
];

type Props = {
  variant: Variant;
  children: ReactNode;
};

export function TermsModal({ variant, children }: Props) {
  const t = useTranslations(variant);
  const sections = variant === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <Dialog>
      <DialogTrigger
        data-testid={`${variant}-modal-trigger`}
        className="cursor-pointer underline underline-offset-4 hover:no-underline"
      >
        {children}
      </DialogTrigger>
      <DialogContent
        data-testid={`${variant}-modal`}
        className="max-h-[80vh] gap-0 overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader className="mb-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
            {t("last_updated")}
          </p>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {t("heading")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </DialogHeader>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.key} data-testid={`${variant}-modal-section-${s.key}`}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em]">
                {t(`section_${s.key}_title`)}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/85">
                {t(`section_${s.key}_body`)}
              </p>
              {s.exceptionKey && (
                <p className="mt-3 border-l-2 border-primary pl-4 text-xs leading-relaxed text-foreground/75">
                  {t(`section_${s.exceptionKey}`)}
                </p>
              )}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
