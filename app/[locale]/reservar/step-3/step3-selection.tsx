"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Duration, Locale } from "@prisma/client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlotsForDate, SlotInstructor } from "@/lib/booking-engine/types";

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

type Props = {
  duration: Duration;
  date: string;
  slots: SlotsForDate;
  initialTime: string | undefined;
  initialInstructorId: string | undefined;
  initialLanguage: string | undefined;
};

const ANYONE = "ANYONE" as const;
type InstructorChoice = typeof ANYONE | string;

function syncUrl(params: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState({}, "", url.toString());
}

function pickInstructor(
  choice: InstructorChoice,
  list: SlotInstructor[],
): SlotInstructor | null {
  if (list.length === 0) return null;
  if (choice === ANYONE) return list[0] ?? null;
  return list.find((i) => i.id === choice) ?? list[0] ?? null;
}

export function Step3Selection({
  duration,
  date,
  slots,
  initialTime,
  initialInstructorId,
  initialLanguage,
}: Props) {
  const t = useTranslations("reservar.step3");
  const router = useRouter();

  const anchors = slots.anchorTimes;
  const initialAnchor = useMemo(() => {
    if (!initialTime) return null;
    const match = anchors.find((a) => a.time === initialTime && a.available);
    return match ? match.time : null;
  }, [anchors, initialTime]);

  const [selectedTime, setSelectedTime] = useState<string | null>(
    initialAnchor,
  );

  const activeAnchor = useMemo(
    () => anchors.find((a) => a.time === selectedTime) ?? null,
    [anchors, selectedTime],
  );
  const candidates = useMemo<SlotInstructor[]>(
    () => activeAnchor?.instructors ?? [],
    [activeAnchor],
  );

  const [instructor, setInstructor] = useState<InstructorChoice>(() => {
    if (!initialAnchor) return ANYONE;
    if (!initialInstructorId) return ANYONE;
    if (initialInstructorId === ANYONE) return ANYONE;
    return candidates.some((c) => c.id === initialInstructorId)
      ? initialInstructorId
      : ANYONE;
  });

  const assigned = useMemo(
    () => pickInstructor(instructor, candidates),
    [instructor, candidates],
  );

  const [language, setLanguage] = useState<Locale | null>(() => {
    if (!assigned) return null;
    const langs = assigned.languages;
    if (langs.length === 0) return null;
    if (initialLanguage) {
      const match = langs.find((l) => l === initialLanguage);
      if (match) return match;
    }
    return langs[0] ?? null;
  });

  function handleAnchorClick(time: string, available: boolean) {
    if (!available) return;
    setSelectedTime(time);
    const next = anchors.find((a) => a.time === time);
    const first = next?.instructors[0] ?? null;
    setInstructor(ANYONE);
    setLanguage(first?.languages[0] ?? null);
    syncUrl({
      time,
      instructor: ANYONE,
      language: first?.languages[0] ?? null,
    });
  }

  function handleInstructorClick(choice: InstructorChoice) {
    setInstructor(choice);
    const next = pickInstructor(choice, candidates);
    const nextLang = next?.languages[0] ?? null;
    setLanguage(nextLang);
    syncUrl({ instructor: choice, language: nextLang });
  }

  function handleLanguageClick(lang: Locale) {
    setLanguage(lang);
    syncUrl({ language: lang });
  }

  function handleContinue() {
    if (!selectedTime || !assigned) return;
    const target = new URLSearchParams({
      duration,
      date,
      time: selectedTime,
      instructor: instructor === ANYONE ? assigned.id : instructor,
    });
    if (language) target.set("language", language);
    router.push(`/reservar/step-4?${target.toString()}`);
  }

  const continueDisabled =
    !selectedTime || !assigned || (assigned.languages.length > 0 && !language);

  return (
    <section data-testid="step3-selection" className="space-y-10">
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("anchors_label")}
        </h2>
        <ul
          role="list"
          data-testid="anchor-list"
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
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("instructors_label")}
          </h2>
          <ul role="list" className="space-y-3">
            <li>
              <button
                type="button"
                data-testid="instructor-anyone"
                data-selected={instructor === ANYONE ? "true" : "false"}
                onClick={() => handleInstructorClick(ANYONE)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  instructor === ANYONE
                    ? "border-foreground bg-foreground text-background"
                    : "border-input hover:border-foreground",
                )}
              >
                {assigned && (
                  <InstructorAvatar
                    name={assigned.name}
                    photo={assigned.photo}
                    size={40}
                    isSelected={instructor === ANYONE}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t("anyone_title")}</p>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      instructor === ANYONE
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
              const isSelected = instructor === cand.id;
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
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("language_label")}
          </h2>
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
    </section>
  );
}
