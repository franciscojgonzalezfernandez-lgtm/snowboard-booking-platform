import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import type { SectionKind } from "../_lib/group";

type Props = {
  kind: SectionKind;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
};

export function SectionEmpty({ kind, t }: Props) {
  return (
    <div
      data-testid={`dashboard-empty-${kind}`}
      className="mt-6 flex flex-col items-start gap-4 border-l-2 border-foreground/60 bg-muted/20 px-6 py-8"
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t(`empty_${kind}`)}
      </p>
      {kind === "upcoming" ? (
        <Link
          href="/reservar"
          data-testid="dashboard-empty-upcoming-cta"
          className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
        >
          {t("empty_upcoming_cta")}
        </Link>
      ) : null}
    </div>
  );
}
