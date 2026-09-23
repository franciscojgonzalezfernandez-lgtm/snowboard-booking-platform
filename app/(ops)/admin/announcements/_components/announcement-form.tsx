"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  announcementInputSchema,
  type AnnouncementInput,
} from "@/lib/schemas/announcement";

import { createAnnouncement, updateAnnouncement } from "../../actions";

const LOCALES = ["en", "de", "es"] as const;
const LOCALE_LABEL: Record<(typeof LOCALES)[number], string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
};

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted fields and try again.",
  NOT_FOUND: "Banner not found — reload the page.",
  BANNER_REQUIRED_BY_PROMO:
    "A promotion is live, so at least one banner must stay enabled. Disable the promo first, or keep another banner enabled.",
};

export type AnnouncementFormDefaults = {
  body: { en: string; de: string; es: string };
  ctaLabel: { en: string; de: string; es: string };
  ctaHref: string;
  enabled: boolean;
};

const EMPTY_DEFAULTS: AnnouncementFormDefaults = {
  body: { en: "", de: "", es: "" },
  ctaLabel: { en: "", de: "", es: "" },
  ctaHref: "",
  enabled: true,
};

type Props =
  | { mode: "create"; onDone: () => void }
  | {
      mode: "edit";
      bannerId: string;
      defaults: AnnouncementFormDefaults;
      onDone: () => void;
    };

export function AnnouncementForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults = props.mode === "edit" ? props.defaults : EMPTY_DEFAULTS;

  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementInputSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });
  const {
    control,
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = form;

  function onValid(values: AnnouncementInput) {
    setServerError(null);
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createAnnouncement(values)
          : await updateAnnouncement({ ...values, id: props.bannerId });

      if (res.ok) {
        toast.success(
          props.mode === "create" ? "Banner created." : "Banner updated.",
        );
        router.refresh();
        props.onDone();
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not save the banner.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<AnnouncementInput>) {
    setServerError("Check the highlighted fields and try again.");
    if (formErrors.body?.en) setFocus("body.en");
    else if (formErrors.ctaHref) setFocus("ctaHref");
  }

  const testId =
    props.mode === "create" ? "announcement-create-form" : "announcement-edit-form";

  return (
    <form
      data-testid={testId}
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-5"
    >
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Banner text (all three required)
        </legend>
        {LOCALES.map((locale) => (
          <div key={locale} className="space-y-1.5">
            <Label htmlFor={`banner-body-${locale}`}>
              {LOCALE_LABEL[locale]}
            </Label>
            <Input
              id={`banner-body-${locale}`}
              data-testid={`banner-body-${locale}`}
              placeholder="Season opening — 20% off 1-hour lessons"
              aria-invalid={errors.body?.[locale] ? "true" : "false"}
              {...register(`body.${locale}`)}
            />
            {errors.body?.[locale] ? (
              <p className="text-xs text-destructive" role="alert">
                Enter the banner text for {LOCALE_LABEL[locale]}.
              </p>
            ) : null}
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Call to action (optional)
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="banner-cta-href">Link</Label>
          <Input
            id="banner-cta-href"
            data-testid="banner-cta-href"
            placeholder="/reservar or https://… or tel:+41…"
            aria-invalid={errors.ctaHref ? "true" : "false"}
            {...register("ctaHref")}
          />
          {errors.ctaHref ? (
            <p className="text-xs text-destructive" role="alert">
              Use an internal path (/reservar), https://, tel: or mailto:. A link
              needs a label in all three languages.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave blank for a banner with no button.
            </p>
          )}
        </div>
        {LOCALES.map((locale) => (
          <div key={locale} className="space-y-1.5">
            <Label htmlFor={`banner-cta-${locale}`}>
              Button label · {LOCALE_LABEL[locale]}
            </Label>
            <Input
              id={`banner-cta-${locale}`}
              data-testid={`banner-cta-${locale}`}
              placeholder="Book now"
              aria-invalid={errors.ctaLabel?.[locale] ? "true" : "false"}
              {...register(`ctaLabel.${locale}`)}
            />
            {errors.ctaLabel?.[locale] ? (
              <p className="text-xs text-destructive" role="alert">
                Add the button label for {LOCALE_LABEL[locale]} (or clear the
                link).
              </p>
            ) : null}
          </div>
        ))}
      </fieldset>

      <div className="flex items-center gap-2.5">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Checkbox
              id="banner-enabled"
              data-testid="banner-enabled"
              checked={field.value ?? true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="banner-enabled" className="cursor-pointer">
          Show this banner on the home page
        </Label>
      </div>

      {serverError ? (
        <p
          data-testid="announcement-form-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" data-testid="announcement-submit" disabled={pending}>
        {pending
          ? "Saving…"
          : props.mode === "create"
            ? "Create banner"
            : "Save changes"}
      </Button>
    </form>
  );
}
