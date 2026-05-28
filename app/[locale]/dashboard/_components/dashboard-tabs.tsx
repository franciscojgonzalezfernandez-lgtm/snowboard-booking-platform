"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { SectionKind } from "../_lib/group";

export type DashboardTab = {
  kind: SectionKind;
  label: string;
  count: number;
  ariaLabel: string;
  content: ReactNode;
};

type Props = {
  tabs: DashboardTab[];
  defaultTab: SectionKind;
};

// Client island: the 4 grouped sections (server-rendered, passed as `content`)
// collapse into one visible panel at a time. The active tab is URL-driven so a
// deep link from a cancellation email (`/dashboard?tab=cancelled`) lands on the
// right view and survives reload. Panels stay mounted (`keepMounted`) so the
// inactive sections keep a stable DOM for revalidation + tests.
export function DashboardTabs({ tabs, defaultTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab");
  const active = tabs.some((tab) => tab.kind === requested)
    ? (requested as SectionKind)
    : defaultTab;

  function selectTab(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      value={active}
      onValueChange={(value) => selectTab(value as string)}
      className="mt-10 gap-0"
    >
      <TabsList
        data-testid="dashboard-tabs"
        variant="line"
        className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-input p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.kind}
            value={tab.kind}
            data-testid={`dashboard-tab-${tab.kind}`}
            aria-label={tab.ariaLabel}
            className="min-h-11 gap-2 px-4 text-xs font-bold uppercase tracking-[0.18em]"
          >
            <span className={cn(tab.count === 0 && "text-muted-foreground")}>
              {tab.label}
            </span>
            {tab.count > 0 ? (
              <span
                data-testid={`dashboard-tab-count-${tab.kind}`}
                aria-hidden
                className="inline-flex min-w-5 items-center justify-center rounded-full border border-input px-1.5 text-[10px] tabular-nums"
              >
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.kind}
          value={tab.kind}
          data-testid={`dashboard-tab-panel-${tab.kind}`}
          keepMounted
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
