"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
  publishableKey: string;
  clientSecret: string;
  bookingId: string;
  totalLabel: string;
};

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(key: string): Promise<Stripe | null> {
  let cached = stripeCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripeCache.set(key, cached);
  }
  return cached;
}

export function PaymentBlock({
  locale,
  publishableKey,
  clientSecret,
  bookingId,
  totalLabel,
}: Props) {
  const stripePromise = useMemo(
    () => getStripePromise(publishableKey),
    [publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#dc2626",
            colorBackground: "#ffffff",
            colorText: "#0f0f0f",
            colorDanger: "#dc2626",
            fontFamily:
              'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
            spacingUnit: "4px",
            borderRadius: "8px",
          },
          rules: {
            ".Input": {
              border: "1px solid #d4d4d4",
              boxShadow: "none",
            },
            ".Input:focus": {
              border: "1px solid #0f0f0f",
              boxShadow: "none",
            },
            ".Label": {
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#525252",
            },
          },
        },
      }}
    >
      <PaymentForm
        locale={locale}
        bookingId={bookingId}
        totalLabel={totalLabel}
      />
    </Elements>
  );
}

function PaymentForm({
  locale,
  bookingId,
  totalLabel,
}: {
  locale: string;
  bookingId: string;
  totalLabel: string;
}) {
  const t = useTranslations("reservar.step5");
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setError(null);
    setPending(true);

    const returnUrl = `${window.location.origin}/${locale}/reservar/exito/${bookingId}`;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (result.error) {
      const code = result.error.code;
      if (code === "card_declined" || code === "insufficient_funds") {
        setError(t("error_declined"));
      } else if (
        code === "authentication_required" ||
        code === "payment_intent_authentication_failure"
      ) {
        setError(t("error_authentication"));
      } else if (code === "payment_intent_payment_attempt_expired") {
        setError(t("error_timeout"));
      } else {
        setError(result.error.message ?? t("error_fallback"));
      }
      setPending(false);
    }
    // On success Stripe redirects to return_url; no manual navigation needed.
  }

  return (
    <form
      data-testid="step5-form"
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
    >
      <PaymentElement data-testid="payment-element" />

      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="step5-payment-error"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        data-testid="step5-pay"
        disabled={!stripe || !elements || pending}
        className="w-full"
      >
        {pending
          ? t("pay_button_working")
          : t("pay_button", { total: totalLabel })}
      </Button>
    </form>
  );
}
