"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phoneFormSchema } from "@/lib/schemas/user-phone";

import { updateUserPhone } from "../actions";

type PersonalPhoneFieldProps = {
  initialPhone: string | null;
};

/**
 * F-064b: inline-editable phone inside the dashboard "Account" card. Display
 * mode shows the value (or a muted placeholder) plus an Edit button; edit mode
 * swaps in an RHF + Zod input with Save / Cancel. Persists via the
 * `updateUserPhone` server action and surfaces the outcome with a sonner toast.
 */
export function PersonalPhoneField({ initialPhone }: PersonalPhoneFieldProps) {
  const t = useTranslations("dashboard");
  const [phone, setPhone] = useState<string | null>(initialPhone);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PhoneFormValues, unknown, PhoneFormResolved>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { phone: initialPhone ?? "" },
  });

  function startEdit() {
    form.reset({ phone: phone ?? "" });
    setEditing(true);
  }

  function cancel() {
    form.clearErrors();
    setEditing(false);
  }

  function onSubmit(values: PhoneFormResolved) {
    const next = values.phone;
    if (next === phone) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateUserPhone(next ?? "");
      if (!res.ok) {
        toast.error(t("personal_error_invalid"));
        return;
      }
      setPhone(res.phone);
      setEditing(false);
      toast.success(
        res.phone === null
          ? t("personal_phone_removed")
          : t("personal_phone_updated"),
      );
    });
  }

  if (!editing) {
    return (
      <dd
        data-testid="dashboard-account-phone"
        className="flex items-start justify-between gap-3 font-display text-lg tracking-tight"
      >
        <span>
          {phone ?? (
            <span className="text-muted-foreground">
              {t("personal_phone_missing")}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="phone-edit"
          onClick={startEdit}
          className="-mt-1 h-auto px-2 py-1 text-xs uppercase tracking-[0.18em]"
        >
          {t("personal_edit")}
        </Button>
      </dd>
    );
  }

  return (
    <dd className="font-display text-lg tracking-tight">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <Input
          type="tel"
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          data-testid="phone-input"
          placeholder={t("personal_phone_placeholder")}
          aria-invalid={Boolean(form.formState.errors.phone)}
          {...form.register("phone")}
        />
        {form.formState.errors.phone ? (
          <p data-testid="phone-error" className="text-xs text-destructive">
            {t("personal_error_invalid")}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            data-testid="phone-save"
            disabled={isPending}
          >
            {t("personal_save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="phone-cancel"
            onClick={cancel}
            disabled={isPending}
          >
            {t("personal_cancel")}
          </Button>
        </div>
      </form>
    </dd>
  );
}

type PhoneFormValues = { phone: string };
type PhoneFormResolved = { phone: string | null };
