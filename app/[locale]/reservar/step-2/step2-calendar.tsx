"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Duration } from "@prisma/client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarDay = {
  date: string;
  hasAvailability: boolean;
  instructorCount: number;
};

type Props = {
  duration: Duration;
  initialMonth: string;
  initialDays: CalendarDay[];
};

const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

function isoMonthAdd(month: string, delta: number): string {
  const [yStr, mStr] = month.split("-");
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [yStr, mStr] = month.split("-");
  return new Date(Date.UTC(Number(yStr), Number(mStr), 0)).getUTCDate();
}

/** Monday=0 … Sunday=6 (Swiss convention). */
function leadingBlanks(month: string): number {
  const [yStr, mStr] = month.split("-");
  const jsDow = new Date(
    Date.UTC(Number(yStr), Number(mStr) - 1, 1),
  ).getUTCDay();
  return (jsDow + 6) % 7;
}

function isoDateOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

// Local-TZ "today" — the booker is physically in Europe/Zurich (CEST/CET) and
// the calendar should follow their wall clock, not UTC. `toLocaleDateString`
// with the Swedish locale conveniently emits ISO `YYYY-MM-DD` from the
// browser's local timezone (used elsewhere in the codebase by Intl helpers).
function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function todayMonthIso(): string {
  return todayIso().slice(0, 7);
}

export function Step2Calendar({ duration, initialMonth, initialDays }: Props) {
  const t = useTranslations("reservar.step2");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState<CalendarDay[]>(initialDays);
  const [loading, setLoading] = useState(false);
  const [nearby, setNearby] = useState<{
    date: string;
    dates: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `today` / `todayMonth` are captured on mount and stay stable for the life
  // of the component. A booking session that crosses local midnight (rare —
  // the flow takes minutes) would keep the previous day as "today" until the
  // next mount; acceptable because the engine itself re-validates against
  // wall-clock `now` on every API call, so a stale UI day at most disables a
  // cell that would have flipped from "today" to "yesterday".
  const today = useMemo(() => todayIso(), []);
  const todayMonth = useMemo(() => todayMonthIso(), []);
  const dayMap = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  );

  // We only sync the `month` query param onto the current URL so that the
  // browser back button / bookmarks reflect the visible month. We deliberately
  // use `window.history.replaceState` instead of `router.replace`:
  //   * the path itself (`/[locale]/reservar/step-2`) doesn't change, so there
  //     is no i18n middleware rewrite to worry about,
  //   * `router.replace` would trigger a Next.js soft navigation which re-runs
  //     the RSC pass for page.tsx and re-fetches `loadEngineContext`. That work
  //     is redundant — the client already has the new `days` from the API
  //     fetch above and owns the canonical state from now on.
  function syncUrlMonth(target: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("month", target);
    window.history.replaceState({}, "", url.toString());
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [month, locale]);

  // Single in-flight controller — any new month / nearby request aborts the
  // previous one. Without this, fast prev/next clicks can resolve out of
  // order and paint the calendar with stale data for the wrong month.
  const inFlightRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      inFlightRef.current?.abort();
    };
  }, []);

  const loadMonth = useCallback(
    async (target: string) => {
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      setLoading(true);
      setError(null);
      setNearby(null);

      try {
        const last = daysInMonth(target);
        const monthFrom = `${target}-01`;
        const monthTo = `${target}-${String(last).padStart(2, "0")}`;
        const url = `/api/availability/calendar?duration=${duration}&monthFrom=${monthFrom}&monthTo=${monthTo}`;
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fetch_failed");
        const json = (await res.json()) as { days: CalendarDay[] };
        setDays(json.days);
        setMonth(target);
        syncUrlMonth(target);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(t("error"));
      } finally {
        if (inFlightRef.current === controller) {
          setLoading(false);
          inFlightRef.current = null;
        }
      }
    },
    [duration, t],
  );

  const fetchNearby = useCallback(
    async (date: string) => {
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const url = `/api/availability/nearby?duration=${duration}&date=${date}`;
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fetch_failed");
        const json = (await res.json()) as { date: string; dates: string[] };
        setNearby({ date, dates: json.dates });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(t("error"));
      } finally {
        if (inFlightRef.current === controller) {
          setLoading(false);
          inFlightRef.current = null;
        }
      }
    },
    [duration, t],
  );

  function handleDayClick(day: CalendarDay) {
    if (day.hasAvailability) {
      router.push(
        `/reservar/step-3?duration=${duration}&date=${day.date}`,
      );
      return;
    }
    void fetchNearby(day.date);
  }

  function gotoNearby(date: string) {
    router.push(`/reservar/step-3?duration=${duration}&date=${date}`);
  }

  const total = daysInMonth(month);
  const blanks = leadingBlanks(month);
  const prevDisabled = loading || month <= todayMonth;

  return (
    <section data-testid="step2-calendar" className="space-y-6">
      <header className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="month-prev"
          disabled={prevDisabled}
          onClick={() => loadMonth(isoMonthAdd(month, -1))}
        >
          {t("prev_month")}
        </Button>
        <p
          data-testid="month-label"
          className="font-display text-xl uppercase tracking-tight"
        >
          {monthLabel}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="month-next"
          disabled={loading}
          onClick={() => loadMonth(isoMonthAdd(month, 1))}
        >
          {t("next_month")}
        </Button>
      </header>

      <div
        role="grid"
        data-testid="calendar-grid"
        className="grid grid-cols-7 gap-2"
      >
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {t(`weekday_${key}`)}
          </div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`b-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
          const iso = isoDateOf(month, d);
          const entry = dayMap.get(iso);
          const past = iso < today;
          const available = !!entry?.hasAvailability;
          const interactive = !past && !!entry && !loading;
          return (
            <button
              key={iso}
              type="button"
              data-testid={`day-${iso}`}
              data-available={available ? "true" : "false"}
              data-past={past ? "true" : "false"}
              disabled={past || loading || !entry}
              onClick={() => entry && handleDayClick(entry)}
              aria-label={
                available ? t("day_available", { date: iso }) : t("day_full", { date: iso })
              }
              className={cn(
                "aspect-square rounded-md border text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                past && "border-transparent text-muted-foreground/40",
                !past &&
                  available &&
                  "border-foreground bg-background font-medium hover:bg-foreground hover:text-background",
                !past &&
                  !available &&
                  "border-input text-muted-foreground hover:border-muted-foreground",
                !interactive && "cursor-not-allowed",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      {loading && (
        <p
          data-testid="step2-loading"
          className="text-sm text-muted-foreground"
        >
          {t("loading")}
        </p>
      )}

      {nearby && !loading && (
        <div
          data-testid="nearby-block"
          className="space-y-3 rounded-lg border border-input p-4"
        >
          <p className="text-sm">
            {t("nearby_intro", { date: nearby.date })}
          </p>
          {nearby.dates.length === 0 ? (
            <p
              data-testid="nearby-empty"
              className="text-sm text-muted-foreground"
            >
              {t("nearby_empty")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {nearby.dates.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    data-testid={`nearby-${d}`}
                    onClick={() => gotoNearby(d)}
                    className="w-full rounded-md border border-foreground px-3 py-2 text-sm hover:bg-foreground hover:text-background"
                  >
                    {new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p data-testid="step2-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
