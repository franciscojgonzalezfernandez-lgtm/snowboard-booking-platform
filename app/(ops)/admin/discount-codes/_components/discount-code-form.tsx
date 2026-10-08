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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { francsToCents } from "@/lib/pricing/chf";
import {
  discountCodeFormSchema,
  type DiscountCodeFormInput,
  type DiscountCodeInput,
} from "@/lib/schemas/discount-code";

import { createDiscountCode, updateDiscountCode } from "../../actions";

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted fields and try again.",
  DUPLICATE_CODE: "A code with that name already exists — pick another.",
  NOT_FOUND: "Code not found — reload the page.",
};

// Map an empty / unparseable number input to undefined (the schema treats
// undefined as "not set" — e.g. a blank redemption cap = unlimited).
function numberOrUndefined(v: unknown): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export type DiscountCodeFormDefaults = {
  code: string;
  label: string;
  discountType: "percent" | "amount";
  percentOff?: number;
  amountFrancs?: number;
  maxRedemptions?: number;
  active: boolean;
};

const EMPTY_DEFAULTS: DiscountCodeFormDefaults = {
  code: "",
  label: "",
  discountType: "percent",
  active: true,
};

type Props =
  | { mode: "create"; onDone: () => void }
  | {
      mode: "edit";
      codeId: string;
      defaults: DiscountCodeFormDefaults;
      onDone: () => void;
    };

export function DiscountCodeForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults = props.mode === "edit" ? props.defaults : EMPTY_DEFAULTS;

  const form = useForm<DiscountCodeFormInput>({
    resolver: zodResolver(discountCodeFormSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    watch,
    formState: { errors },
  } = form;

  const discountType = watch("discountType");

  function onValid(values: DiscountCodeFormInput) {
    setServerError(null);
    // Convert the client (francs + type) shape to the authoritative server
    // (cents, XOR) shape. Only the selected discount kind is sent.
    const serverInput: DiscountCodeInput = {
      code: values.code,
      label: values.label.trim() ? values.label.trim() : undefined,
      active: values.active,
      ...(values.discountType === "percent"
        ? { percentOff: values.percentOff }
        : { amountOffCents: francsToCents(values.amountFrancs as number) }),
      ...(values.maxRedemptions != null
        ? { maxRedemptions: values.maxRedemptions }
        : {}),
    };

    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createDiscountCode(serverInput)
          : await updateDiscountCode({ ...serverInput, id: props.codeId });

      if (res.ok) {
        toast.success(
          props.mode === "create" ? "Discount code created." : "Discount code updated.",
        );
        router.refresh();
        props.onDone();
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not save the code.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<DiscountCodeFormInput>) {
    setServerError("Check the highlighted fields and try again.");
    if (formErrors.code) {
      setFocus("code");
      return;
    }
    if (formErrors.percentOff) {
      setFocus("percentOff");
      return;
    }
    if (formErrors.amountFrancs) {
      setFocus("amountFrancs");
      return;
    }
    if (formErrors.maxRedemptions) setFocus("maxRedemptions");
  }

  const testId = props.mode === "create" ? "discount-create-form" : "discount-edit-form";

  return (
    <form
      data-testid={testId}
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="discount-code">Code</Label>
        <Input
          id="discount-code"
          data-testid="discount-code"
          placeholder="VERGANI"
          autoCapitalize="characters"
          aria-invalid={errors.code ? "true" : "false"}
          {...register("code")}
        />
        {errors.code ? (
          <p className="text-xs text-destructive" role="alert">
            2–40 characters, letters/digits/hyphen only.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Case-insensitive — stored and matched in uppercase.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="discount-label">Label (internal, optional)</Label>
        <Input
          id="discount-label"
          data-testid="discount-label"
          placeholder="Vergani influencer"
          aria-invalid={errors.label ? "true" : "false"}
          {...register("label")}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Discount type</legend>
        <Controller
          control={control}
          name="discountType"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(value) => field.onChange(value as "percent" | "amount")}
              className="gap-3"
            >
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="percent" data-testid="discount-type-percent" />
                Percentage off
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="amount" data-testid="discount-type-amount" />
                Fixed amount off (CHF)
              </Label>
            </RadioGroup>
          )}
        />
      </fieldset>

      {discountType === "percent" ? (
        <div className="space-y-1.5">
          <Label htmlFor="discount-percent">Percentage off</Label>
          <Input
            id="discount-percent"
            data-testid="discount-percent"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            placeholder="10"
            aria-invalid={errors.percentOff ? "true" : "false"}
            {...register("percentOff", { setValueAs: numberOrUndefined })}
          />
          {errors.percentOff ? (
            <p className="text-xs text-destructive" role="alert">
              Enter a whole number between 1 and 100.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="discount-amount">Amount off (CHF)</Label>
          <Input
            id="discount-amount"
            data-testid="discount-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.05"
            placeholder="20"
            aria-invalid={errors.amountFrancs ? "true" : "false"}
            {...register("amountFrancs", { setValueAs: numberOrUndefined })}
          />
          {errors.amountFrancs ? (
            <p className="text-xs text-destructive" role="alert">
              Enter an amount greater than 0.
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="discount-max">Max total redemptions (optional)</Label>
        <Input
          id="discount-max"
          data-testid="discount-max"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Leave blank for unlimited"
          aria-invalid={errors.maxRedemptions ? "true" : "false"}
          {...register("maxRedemptions", { setValueAs: numberOrUndefined })}
        />
        <p className="text-xs text-muted-foreground">
          A global cap across all customers. Each customer can use a code once
          regardless of this value.
        </p>
        {errors.maxRedemptions ? (
          <p className="text-xs text-destructive" role="alert">
            Enter a whole number of 1 or more, or leave blank.
          </p>
        ) : null}
      </div>

      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <Label className="flex items-center gap-3 font-normal">
            <Checkbox
              data-testid="discount-active"
              checked={Boolean(field.value)}
              onCheckedChange={(value) => field.onChange(value === true)}
            />
            Active (bookers can apply it)
          </Label>
        )}
      />

      {serverError ? (
        <p
          data-testid="discount-form-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" data-testid="discount-submit" disabled={pending}>
        {pending
          ? "Saving…"
          : props.mode === "create"
            ? "Create code"
            : "Save changes"}
      </Button>
    </form>
  );
}
