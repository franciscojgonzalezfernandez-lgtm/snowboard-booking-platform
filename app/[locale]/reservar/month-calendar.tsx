"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Duration } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarDay, SlotsForDate } from "@/lib/booking-engine/types";
import { useBookingUrlState } from "./use-booking-url-state";

type Props = {
  duration: Duration;
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

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function todayMonthIso(): string {
  return todayIso().slice(0, 7);
}

function monthBounds(month: string): { monthFrom: string; monthTo: string } {
  const last = daysInMonth(month);
  return {
    monthFrom: `${month}-01`,
    monthTo: `${month}-${String(last).padStart(2, "0")}`,
  };
}

async function fetchCalendar(
  duration: Duration,
  month: string,
): Promise<{ days: CalendarDay[] }> {
  const { monthFrom, monthTo } = monthBounds(month);
  const url = `/api/availability/calendar?duration=${duration}&monthFrom=${monthFrom}&monthTo=${monthTo}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("calendar_fetch_failed");
  return res.json() as Promise<{ days: CalendarDay[] }>;
}

async function fetchNearby(
  duration: Duration,
  date: string,
): Promise<{ date: string; dates: string[] }> {
  const url = `/api/availability/nearby?duration=${duration}&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("nearby_fetch_failed");
  return res.json() as Promise<{ date: string; dates: string[] }>;
}

async function fetchSlots(
  duration: Duration,
  date: string,
): Promise<SlotsForDate> {
  const url = `/api/availability/slots?duration=${duration}&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("slots_fetch_failed");
  return res.json() as Promise<SlotsForDate>;
}

function scrollToSection3() {
  const el = document.getElementById("section-3");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusable = el.querySelector<HTMLElement>("[data-section-focus]");
  focusable?.focus({ preventScroll: true });
}

export function MonthCalendar({ duration }: Props) {
  const t = useTranslations("reservar.step2");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { state, set } = useBookingUrlState();

  const initialMonth = useMemo(() => {
    if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
      return state.date.slice(0, 7);
    }
    return todayMonthIso();
  }, [state.date]);

  const [month, setMonth] = useState(initialMonth);
  const [nearby, setNearby] = useState<{
    date: string;
    dates: string[];
  } | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);
  const todayMonth = useMemo(() => todayMonthIso(), []);

  const calendarQuery = useQuery({
    queryKey: ["availability", "calendar", duration, month],
    queryFn: () => fetchCalendar(duration, month),
  });

  const days = calendarQuery.data?.days ?? [];
  const loading = calendarQuery.isFetching;
  const fetchError = calendarQuery.isError ? t("error") : null;

  const dayMap = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  );

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [month, locale]);

  const handlePrefetchSlots = useCallback(
    (date: string) => {
      queryClient.prefetchQuery({
        queryKey: ["availability", "slots", duration, date],
        queryFn: () => fetchSlots(duration, date),
        staleTime: 30_000,
      });
    },
    [duration, queryClient],
  );

  const handleDayClick = useCallback(
    async (day: CalendarDay) => {
      if (day.hasAvailability) {
        setNearby(null);
        set({
          date: day.date,
          time: undefined,
          instructorId: undefined,
          language: undefined,
        });
        requestAnimationFrame(() => scrollToSection3());
        return;
      }
      setNearbyLoading(true);
      setNearbyError(null);
      try {
        const data = await fetchNearby(duration, day.date);
        setNearby({ date: day.date, dates: data.dates });
      } catch {
        setNearbyError(t("error"));
      } finally {
        setNearbyLoading(false);
      }
    },
    [duration, set, t],
  );

  const handleNearbyClick = useCallback(
    (date: string) => {
      setNearby(null);
      set({
        date,
        time: undefined,
        instructorId: undefined,
        language: undefined,
      });
      requestAnimationFrame(() => scrollToSection3());
    },
    [set],
  );

  // Reset month view if duration changes from outside (no-op when first mount).
  useEffect(() => {
    setNearby(null);
  }, [duration]);

  // Keep the visible month in sync with the URL's selected date so a
  // deep-link / soft-nav into ?dt= in another month re-centers the grid
  // on the right month. User-driven prev/next clicks do not write `dt`,
  // so this effect cannot fight the user's own navigation.
  useEffect(() => {
    if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
      const target = state.date.slice(0, 7);
      setMonth((prev) => (prev !== target ? target : prev));
    }
  }, [state.date]);

  const total = daysInMonth(month);
  const blanks = leadingBlanks(month);
  const prevDisabled = loading || month <= todayMonth;

  return (
    <div data-testid="month-calendar" className="space-y-6">
      <header className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="month-prev"
          disabled={prevDisabled}
          onClick={() => setMonth(isoMonthAdd(month, -1))}
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
          onClick={() => setMonth(isoMonthAdd(month, 1))}
        >
          {t("next_month")}
        </Button>
      </header>

      <div
        role="grid"
        data-testid="calendar-grid"
        data-section-focus
        tabIndex={-1}
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
          const isSelected = state.date === iso;
          return (
            <button
              key={iso}
              type="button"
              data-testid={`day-${iso}`}
              data-available={available ? "true" : "false"}
              data-past={past ? "true" : "false"}
              data-selected={isSelected ? "true" : "false"}
              disabled={past || loading || !entry}
              onMouseEnter={
                available ? () => handlePrefetchSlots(iso) : undefined
              }
              onFocus={available ? () => handlePrefetchSlots(iso) : undefined}
              onClick={() => entry && handleDayClick(entry)}
              aria-label={
                available
                  ? t("day_available", { date: iso })
                  : t("day_full", { date: iso })
              }
              className={cn(
                "aspect-square rounded-md border text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                past && "border-transparent text-muted-foreground/40",
                !past &&
                  available &&
                  !isSelected &&
                  "border-foreground bg-background font-medium hover:bg-foreground hover:text-background",
                !past &&
                  available &&
                  isSelected &&
                  "border-foreground bg-foreground font-medium text-background",
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

      {(loading || nearbyLoading) && (
        <p
          data-testid="step2-loading"
          className="text-sm text-muted-foreground"
        >
          {t("loading")}
        </p>
      )}

      {nearby && !nearbyLoading && (
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
                    onClick={() => handleNearbyClick(d)}
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

      {(fetchError || nearbyError) && (
        <p data-testid="step2-error" className="text-sm text-destructive">
          {fetchError ?? nearbyError}
        </p>
      )}
    </div>
  );
}
