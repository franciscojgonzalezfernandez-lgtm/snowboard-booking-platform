"use client";

import { useState, useTransition } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAvailabilityBlockSchema,
  type CreateAvailabilityBlockInput,
} from "@/lib/schemas/availability-block";

import { createAvailabilityBlock } from "../../actions";

// Server error code → instructor-facing copy. Inline EN per the routing
// convention (/instructor is outside [locale]).
const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Pick a valid date and time range.",
  OUT_OF_SEASON: "That date is outside the active season.",
  OVERLAP: "Overlaps with another availability window.",
  NO_ACTIVE_SEASON: "No active season is configured. Contact the admin.",
};

const FIELD_ORDER: Path<CreateAvailabilityBlockInput>[] = [
  "date",
  "startTime",
  "endTime",
];

export function CreateBlockForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateAvailabilityBlockInput>({
    resolver: zodResolver(createAvailabilityBlockSchema),
    mode: "onTouched",
    defaultValues: { date: "", startTime: "", endTime: "" },
  });
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = form;

  function onValid(values: CreateAvailabilityBlockInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createAvailabilityBlock(values);
      if (res.ok) {
        reset({ date: "", startTime: "", endTime: "" });
        toast.success("Availability window added.");
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not add the window.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<CreateAvailabilityBlockInput>) {
    setServerError("Check the highlighted fields and try again.");
    const first = FIELD_ORDER.find((k) => formErrors[k]);
    if (first) setFocus(first);
  }

  return (
    <form
      data-testid="availability-create-form"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="availability-date">Date</Label>
          <Input
            id="availability-date"
            data-testid="availability-date"
            type="date"
            aria-invalid={errors.date ? "true" : "false"}
            aria-describedby={errors.date ? "availability-date-error" : undefined}
            {...register("date")}
          />
          {errors.date ? (
            <p
              id="availability-date-error"
              className="text-xs text-destructive"
              role="alert"
            >
              Pick a valid date.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="availability-start">Starts at</Label>
          <Input
            id="availability-start"
            data-testid="availability-start"
            type="time"
            step={900}
            aria-invalid={errors.startTime ? "true" : "false"}
            aria-describedby={
              errors.startTime ? "availability-start-error" : undefined
            }
            {...register("startTime")}
          />
          {errors.startTime ? (
            <p
              id="availability-start-error"
              className="text-xs text-destructive"
              role="alert"
            >
              Pick a start time.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="availability-end">Ends at</Label>
          <Input
            id="availability-end"
            data-testid="availability-end"
            type="time"
            step={900}
            aria-invalid={errors.endTime ? "true" : "false"}
            aria-describedby={
              errors.endTime ? "availability-end-error" : undefined
            }
            {...register("endTime")}
          />
          {errors.endTime ? (
            <p
              id="availability-end-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {errors.endTime.message === "END_BEFORE_OR_EQUAL_START"
                ? "Must be after the start time."
                : "Pick an end time."}
            </p>
          ) : null}
        </div>
      </div>

      {serverError ? (
        <p
          data-testid="availability-create-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        data-testid="availability-create-submit"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add window"}
      </Button>
    </form>
  );
}
