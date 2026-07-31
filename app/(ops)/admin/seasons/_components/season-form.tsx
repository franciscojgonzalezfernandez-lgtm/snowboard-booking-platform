"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seasonInputSchema, type SeasonInput } from "@/lib/schemas/season";

import { createSeason, updateSeason } from "../../actions";

// Order used to focus the first invalid field (form-fix pattern, PR #100:
// submit is never disabled by `!isValid`; we surface + focus errors instead).
const FIELD_ORDER: (keyof SeasonInput)[] = [
  "name",
  "startDate",
  "endDate",
  "anchorTimes",
  "operatingHoursStart",
  "operatingHoursEnd",
];

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted fields and try again.",
  NOT_FOUND: "Season not found — reload the page.",
  HAS_BOOKINGS_OUT_OF_RANGE:
    "Can't narrow the dates/anchors: confirmed or pending bookings would fall outside the new range. Move or cancel them first.",
};

export type SeasonFormDefaults = {
  name: string;
  startDate: string;
  endDate: string;
  anchorTimes: string[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
};

const EMPTY_DEFAULTS: SeasonFormDefaults = {
  name: "",
  startDate: "",
  endDate: "",
  anchorTimes: [],
  operatingHoursStart: "09:00",
  operatingHoursEnd: "16:00",
};

type Props =
  | { mode: "create"; onDone: () => void }
  | { mode: "edit"; seasonId: string; defaults: SeasonFormDefaults; onDone: () => void };

export function SeasonForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults = props.mode === "edit" ? props.defaults : EMPTY_DEFAULTS;

  const form = useForm<SeasonInput>({
    resolver: zodResolver(seasonInputSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = form;

  function onValid(values: SeasonInput) {
    setServerError(null);
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createSeason(values)
          : await updateSeason({ ...values, id: props.seasonId });

      if (res.ok) {
        toast.success(
          props.mode === "create" ? "Season created." : "Season updated.",
        );
        router.refresh();
        props.onDone();
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not save the season.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<SeasonInput>) {
    setServerError("Check the highlighted fields and try again.");
    const first = FIELD_ORDER.find((f) => formErrors[f]);
    if (first) setFocus(first);
  }

  const testId = props.mode === "create" ? "season-create-form" : "season-edit-form";

  return (
    <form
      data-testid={testId}
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="season-name">Name</Label>
        <Input
          id="season-name"
          data-testid="season-name"
          placeholder="Season 27/28"
          aria-invalid={errors.name ? "true" : "false"}
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-xs text-destructive" role="alert">
            Enter a name (1–120 characters).
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="season-start">Start date</Label>
          <Input
            id="season-start"
            data-testid="season-start"
            type="date"
            aria-invalid={errors.startDate ? "true" : "false"}
            {...register("startDate")}
          />
          {errors.startDate ? (
            <p className="text-xs text-destructive" role="alert">
              Enter a valid start date.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="season-end">End date</Label>
          <Input
            id="season-end"
            data-testid="season-end"
            type="date"
            aria-invalid={errors.endDate ? "true" : "false"}
            {...register("endDate")}
          />
          {errors.endDate ? (
            <p className="text-xs text-destructive" role="alert">
              End date must be after the start date.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="season-anchors">Anchor times</Label>
        <Input
          id="season-anchors"
          data-testid="season-anchors"
          placeholder="09:00, 11:00, 13:00, 15:00"
          defaultValue={defaults.anchorTimes.join(", ")}
          aria-invalid={errors.anchorTimes ? "true" : "false"}
          {...register("anchorTimes", {
            setValueAs: (v: unknown) =>
              typeof v === "string"
                ? v.split(",").map((s) => s.trim()).filter(Boolean)
                : (v ?? []),
          })}
        />
        {errors.anchorTimes ? (
          <p className="text-xs text-destructive" role="alert">
            Comma-separated “HH:MM”, at least one, each within operating hours.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Comma-separated 24h times when a class may start.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="season-ops-start">Operating hours — start</Label>
          <Input
            id="season-ops-start"
            data-testid="season-ops-start"
            type="time"
            aria-invalid={errors.operatingHoursStart ? "true" : "false"}
            {...register("operatingHoursStart")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="season-ops-end">Operating hours — end</Label>
          <Input
            id="season-ops-end"
            data-testid="season-ops-end"
            type="time"
            aria-invalid={errors.operatingHoursEnd ? "true" : "false"}
            {...register("operatingHoursEnd")}
          />
          {errors.operatingHoursEnd ? (
            <p className="text-xs text-destructive" role="alert">
              End must be after the start.
            </p>
          ) : null}
        </div>
      </div>

      {serverError ? (
        <p
          data-testid="season-form-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        New seasons start inactive with no prices. Set prices in{" "}
        <span className="font-medium">Pricing</span>, then activate. Opening
        availability for the new dates is done from the instructor calendar.
      </p>

      <Button type="submit" data-testid="season-submit" disabled={pending}>
        {pending
          ? "Saving…"
          : props.mode === "create"
            ? "Create season"
            : "Save changes"}
      </Button>
    </form>
  );
}
