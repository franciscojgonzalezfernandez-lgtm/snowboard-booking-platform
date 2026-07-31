"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type BookingUrlState = {
  duration?: string;
  date?: string;
  time?: string;
  instructorId?: string;
  language?: string;
};

const KEY_MAP = {
  duration: "d",
  date: "dt",
  time: "t",
  instructorId: "i",
  language: "l",
} as const satisfies Record<keyof BookingUrlState, string>;

export function useBookingUrlState(): {
  state: BookingUrlState;
  set: (patch: Partial<BookingUrlState>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo<BookingUrlState>(
    () => ({
      duration: params.get(KEY_MAP.duration) ?? undefined,
      date: params.get(KEY_MAP.date) ?? undefined,
      time: params.get(KEY_MAP.time) ?? undefined,
      instructorId: params.get(KEY_MAP.instructorId) ?? undefined,
      language: params.get(KEY_MAP.language) ?? undefined,
    }),
    [params],
  );

  const set = useCallback(
    (patch: Partial<BookingUrlState>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const key = KEY_MAP[k as keyof BookingUrlState];
        if (v === undefined || v === null || v === "") next.delete(key);
        else next.set(key, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { state, set };
}
