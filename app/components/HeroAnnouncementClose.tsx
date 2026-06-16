"use client";

import { X } from "lucide-react";
import { useTransition } from "react";

import { dismissHeroAnnouncement } from "@/app/[locale]/(marketing)/actions";
import { useRouter } from "@/i18n/navigation";

/**
 * Minimal client island: the only JS the banner ships. Dismisses the banner,
 * persists the cookie via the Server Action, then refreshes so the server
 * component re-evaluates and drops the band. 44px tap target (F-051 audit).
 */
export function HeroAnnouncementClose({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await dismissHeroAnnouncement();
          router.refresh();
        })
      }
      className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-primary-foreground/75 transition-colors hover:text-primary-foreground disabled:opacity-50"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}
