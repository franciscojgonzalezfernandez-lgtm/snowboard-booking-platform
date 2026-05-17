"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";

const DURATIONS = ["ONE_HOUR", "TWO_HOURS", "INTENSIVE", "FULL_DAY"] as const;

const DURATION_LABEL_KEYS: Record<(typeof DURATIONS)[number], string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

export function Step1FiltersForm() {
  const t = useTranslations("reservar.step1");
  const router = useRouter();

  const schema = useMemo(
    () =>
      z.object({
        duration: z.enum(DURATIONS, {
          message: t("validation_duration_required"),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      duration: undefined as unknown as FormValues["duration"],
    },
  });

  function onSubmit(values: FormValues) {
    const params = new URLSearchParams({ duration: values.duration });
    router.push(`/reservar/step-2?${params.toString()}`);
  }

  const selectClass = cn(
    "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "md:text-sm",
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <FormField
          control={form.control}
          name="duration"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("duration_label")}</FormLabel>
              <FormControl>
                <select
                  {...field}
                  data-testid="select-duration"
                  aria-invalid={!!fieldState.error}
                  className={selectClass}
                  value={field.value ?? ""}
                >
                  <option value="" disabled>
                    {t("duration_placeholder")}
                  </option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(DURATION_LABEL_KEYS[d])}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          data-testid="submit-step1"
          className="w-full"
        >
          {t("cta_continue")}
        </Button>
      </form>
    </Form>
  );
}
