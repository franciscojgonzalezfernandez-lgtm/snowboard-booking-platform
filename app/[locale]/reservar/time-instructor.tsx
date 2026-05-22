"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Duration, Locale } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SlotsForDate,
  SlotInstructor,
} from "@/lib/booking-engine/types";
import { useBookingUrlState } from "./use-booking-url-state";

const ANYONE = "ANYONE" as const;
type InstructorChoice = typeof ANYONE | string;

type Props = {
  duration: Duration;
  date: string;
};

async function fetchSlots(
  duration: Duration,
  date: string,
): Promise<SlotsForDate> {
  const url = `/api/availability/slots?duration=${duration}&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("slots_fetch_failed");
  return res.json() as Promise<SlotsForDate>;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function InstructorAvatar({
  name,
  photo,
  size,
  isSelected,
}: {
  name: string | null | undefined;
  photo: string | null | undefined;
  size: number;
  isSelected: boolean;
}) {
  const label = name ?? "";
  if (photo) {
    return (
      <Image
        src={photo}
        alt={label}
        width={size}
        height={size}
        sizes={`${size}px`}
        data-testid="instructor-photo"
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid="instructor-photo-fallback"
      style={{ width: size, height: size }}
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wider",
        isSelected
          ? "bg-background/15 text-background"
          : "bg-muted text-muted-foreground",
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}

function pickInstructor(
  choice: InstructorChoice,
  list: SlotInstructor[],
): SlotInstructor | null {
  if (list.length === 0) return null;
  if (choice === ANYONE) return list[0] ?? null;
  return list.find((i) => i.id === choice) ?? list[0] ?? null;
}

export function TimeInstructor({ duration, date }: Props) {
  const t = useTranslations("reservar.step3");
  const { state, set } = useBookingUrlState();

  const slotsQuery = useQuery({
    queryKey: ["availability", "slots", duration, date],
    queryFn: () => fetchSlots(duration, date),
  });

  const slots = slotsQuery.data;
  const anchors = useMemo(() => slots?.anchorTimes ?? [], [slots]);

  const selectedTime = state.time ?? null;
  const activeAnchor = useMemo(
    () => anchors.find((a) => a.time === selectedTime) ?? null,
    [anchors, selectedTime],
  );
  const candidates = useMemo<SlotInstructor[]>(
    () => activeAnchor?.instructors ?? [],
    [activeAnchor],
  );

  const instructorChoice: InstructorChoice = useMemo(() => {
    if (!selectedTime) return ANYONE;
    if (!state.instructorId) return ANYONE;
    if (state.instructorId === ANYONE) return ANYONE;
    return candidates.some((c) => c.id === state.instructorId)
      ? state.instructorId
      : ANYONE;
  }, [selectedTime, state.instructorId, candidates]);

  const assigned = useMemo(
    () => pickInstructor(instructorChoice, candidates),
    [instructorChoice, candidates],
  );

  const language = useMemo<Locale | null>(() => {
    if (!assigned) return null;
    const langs = assigned.languages;
    if (langs.length === 0) return null;
    if (state.language) {
      const match = langs.find((l) => l === state.language);
      if (match) return match;
    }
    return langs[0] ?? null;
  }, [assigned, state.language]);

  // Mirror the resolved language back into the URL when the engine narrows it
  // (e.g. picking a new anchor causes the first language to win). Without this
  // a fresh anchor pick would leave ?l= pointing at a language the new
  // instructor does not teach.
  useEffect(() => {
    if (selectedTime && assigned && language && state.language !== language) {
      set({ language });
    }
    if (selectedTime && assigned && !language && state.language) {
      set({ language: undefined });
    }
  }, [selectedTime, assigned, language, state.language, set]);

  function handleAnchorClick(time: string, available: boolean) {
    if (!available) return;
    set({
      time,
      instructorId: ANYONE,
      language: undefined,
    });
  }

  function handleInstructorClick(choice: InstructorChoice) {
    set({ instructorId: choice, language: undefined });
  }

  function handleLanguageClick(lang: Locale) {
    set({ language: lang });
  }

  function handleContinue() {
    if (!selectedTime || !assigned) return;
    const resolvedInstructor =
      instructorChoice === ANYONE ? assigned.id : instructorChoice;
    // Ensure the URL carries the resolved instructor + language so a soft
    // navigation into Section 4 has all keys the RSC needs to gate auth +
    // fetch instructor name.
    set({
      instructorId: resolvedInstructor,
      language: language ?? undefined,
    });
    requestAnimationFrame(() => {
      const target = document.getElementById("section-4");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = target.querySelector<HTMLElement>(
        "[data-section-focus]",
      );
      focusable?.focus({ preventScroll: true });
    });
  }

  const continueDisabled =
    !selectedTime || !assigned || (assigned.languages.length > 0 && !language);

  if (slotsQuery.isLoading) {
    return (
      <div data-testid="time-instructor-loading" className="text-sm text-muted-foreground">
        {t("anchors_label")}…
      </div>
    );
  }

  if (slotsQuery.isError || !slots) {
    return (
      <p
        data-testid="time-instructor-error"
        className="text-sm text-destructive"
      >
        {t("anchors_label")} — {String(slotsQuery.error)}
      </p>
    );
  }

  return (
    <div data-testid="time-instructor" className="space-y-10">
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("anchors_label")}
        </h3>
        <ul
          role="list"
          data-testid="anchor-list"
          data-section-focus
          tabIndex={-1}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
        >
          {anchors.map((anchor) => {
            const isSelected = anchor.time === selectedTime;
            return (
              <li key={anchor.time}>
                <button
                  type="button"
                  data-testid={`anchor-${anchor.time}`}
                  data-available={anchor.available ? "true" : "false"}
                  data-selected={isSelected ? "true" : "false"}
                  disabled={!anchor.available}
                  onClick={() =>
                    handleAnchorClick(anchor.time, anchor.available)
                  }
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-base transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !anchor.available &&
                      "border-input text-muted-foreground cursor-not-allowed",
                    anchor.available &&
                      !isSelected &&
                      "border-foreground hover:bg-foreground hover:text-background",
                    anchor.available &&
                      isSelected &&
                      "border-foreground bg-foreground text-background",
                  )}
                >
                  {anchor.time}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedTime && candidates.length > 0 && (
        <div className="space-y-4" data-testid="instructor-section">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("instructors_label")}
          </h3>
          <ul role="list" className="space-y-3">
            <li>
              <button
                type="button"
                data-testid="instructor-anyone"
                data-selected={instructorChoice === ANYONE ? "true" : "false"}
                onClick={() => handleInstructorClick(ANYONE)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  instructorChoice === ANYONE
                    ? "border-foreground bg-foreground text-background"
                    : "border-input hover:border-foreground",
                )}
              >
                {assigned && (
                  <InstructorAvatar
                    name={assigned.name}
                    photo={assigned.photo}
                    size={40}
                    isSelected={instructorChoice === ANYONE}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t("anyone_title")}</p>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      instructorChoice === ANYONE
                        ? "text-background/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {assigned
                      ? t("anyone_sub_assigned", {
                          name: assigned.name ?? t("instructor_unnamed"),
                        })
                      : t("anyone_sub_none")}
                  </p>
                </div>
              </button>
            </li>
            {candidates.map((cand) => {
              const isSelected = instructorChoice === cand.id;
              return (
                <li key={cand.id}>
                  <button
                    type="button"
                    data-testid={`instructor-${cand.id}`}
                    data-selected={isSelected ? "true" : "false"}
                    onClick={() => handleInstructorClick(cand.id)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-md border px-4 py-4 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-input hover:border-foreground",
                    )}
                  >
                    <InstructorAvatar
                      name={cand.name}
                      photo={cand.photo}
                      size={64}
                      isSelected={isSelected}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">
                          {cand.name ?? t("instructor_unnamed")}
                        </p>
                        <p
                          className={cn(
                            "text-xs uppercase tracking-wider",
                            isSelected
                              ? "text-background/80"
                              : "text-muted-foreground",
                          )}
                          data-testid={`instructor-${cand.id}-languages`}
                        >
                          {cand.languages.length > 0
                            ? cand.languages.join(" · ").toUpperCase()
                            : t("languages_none")}
                        </p>
                      </div>
                      {cand.specialties && cand.specialties.length > 0 && (
                        <p
                          className={cn(
                            "mt-2 text-xs",
                            isSelected
                              ? "text-background/80"
                              : "text-muted-foreground",
                          )}
                        >
                          {cand.specialties.join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {assigned && assigned.languages.length > 1 && (
        <div className="space-y-3" data-testid="language-section">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("language_label")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("language_sub", {
              name: assigned.name ?? t("instructor_unnamed"),
            })}
          </p>
          <ul role="list" className="flex flex-wrap gap-2">
            {assigned.languages.map((lang) => {
              const isSelected = language === lang;
              return (
                <li key={lang}>
                  <button
                    type="button"
                    data-testid={`language-${lang}`}
                    data-selected={isSelected ? "true" : "false"}
                    onClick={() => handleLanguageClick(lang)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs uppercase tracking-wider transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-input hover:border-foreground",
                    )}
                  >
                    {lang}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {assigned && assigned.languages.length === 1 && language && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="language-auto"
        >
          {t("language_auto", { language: language.toUpperCase() })}
        </p>
      )}

      <div>
        <Button
          type="button"
          data-testid="step3-continue"
          disabled={continueDisabled}
          onClick={handleContinue}
          className="w-full sm:w-auto"
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}
