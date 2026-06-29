"use client";

import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FaqItem = { q: string; a: string };

// Client island: the accordion is interactive (open/close, keyboard), so the
// page stays a Server Component and hands the translated Q&A down through the
// same `faq.items` array the FAQPage JSON-LD is built from — one source of
// truth, no copy drift between the visible accordion and the structured data.
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const t = useTranslations("faq");

  return (
    <Accordion
      data-testid="faq-accordion"
      className="border-y border-foreground/15"
      aria-label={t("aria_label")}
    >
      {items.map((item, i) => (
        <AccordionItem
          key={i}
          value={`faq-${i}`}
          data-testid={`faq-item-${i}`}
          className="border-b border-foreground/15 last:border-b-0"
        >
          <AccordionTrigger className="gap-6 py-6 text-base font-medium tracking-tight hover:no-underline sm:text-lg">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[60ch] text-base leading-relaxed text-foreground/75">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
