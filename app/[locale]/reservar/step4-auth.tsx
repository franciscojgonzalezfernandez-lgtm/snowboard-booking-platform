"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { authClient } from "@/lib/auth/client";

type Step4AuthProps = {
  /** Where OAuth / magic-link round-trips return to — the current funnel URL
   * with its full draft in the query string (built server-side). */
  callbackURL: string;
};

/**
 * F-119: booking-funnel-native auth, embedded in Section 4 instead of a link
 * out to `/login`. Three methods (Google, magic link, email+password) with
 * auto-provisioning and no sign-in/sign-up toggle:
 *
 * - Google + magic link auto-create the account on first use (Better Auth
 *   default). Both leave the page briefly and return via `callbackURL`; the
 *   draft survives because it lives in the URL.
 * - Email+password uses a single "continue" submit: it attempts sign-up first
 *   and falls back to sign-in when the account already exists. This is the
 *   only fully on-page path — on success we `router.refresh()` in place so the
 *   RSC re-reads the session and Section 4 flips to the payment flow with no
 *   navigation at all.
 *
 * Copy is reused from the shared `login` namespace (client-available under the
 * root NextIntlClientProvider), same as `login-form.tsx`.
 */
export function Step4Auth({ callbackURL }: Step4AuthProps) {
  const t = useTranslations("login");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("validation_email_invalid")),
        password: z.string().min(8, t("validation_password_min")),
      }),
    [t],
  );

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit({ email, password }: Values) {
    setError(null);
    setMagicSent(false);
    startTransition(async () => {
      // Auto-provision: create the account first. If it already exists, fall
      // back to signing in with the same credentials. This ordering keeps a
      // wrong password on an existing account surfacing as a real sign-in
      // error, instead of the ambiguous "invalid credentials" that a
      // sign-in-first flow returns for both wrong-password and unknown-user.
      const name = email.split("@")[0] || email;
      const signUp = await authClient.signUp.email({ email, password, name });

      if (signUp.error) {
        if (signUp.error.code !== "USER_ALREADY_EXISTS") {
          setError(signUp.error.message ?? t("error_fallback"));
          return;
        }
        const signIn = await authClient.signIn.email({ email, password });
        if (signIn.error) {
          setError(signIn.error.message ?? t("error_fallback"));
          return;
        }
      }

      // Session cookie is now set. Re-render the server component in place —
      // no push, so we stay on the funnel URL and Section 4 becomes payment.
      router.refresh();
    });
  }

  async function onGoogle() {
    setError(null);
    await authClient.signIn.social({ provider: "google", callbackURL });
  }

  async function onMagicLink() {
    setError(null);
    const email = form.getValues("email");
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      form.setError("email", { message: t("validation_email_first") });
      return;
    }
    setMagicSent(false);
    const result = await authClient.signIn.magicLink({
      email: parsed.data,
      callbackURL,
    });
    if (result.error) {
      setError(
        result.error.code === "MAGIC_LINK_DELIVERY_FAILED"
          ? t("error_magic_link_delivery_failed")
          : (result.error.message ?? t("error_fallback")),
      );
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="mt-6 space-y-5" data-testid="step4-auth">
      {/* Google leads — the fastest path for most bookers. Carries the
          section-focus hook so the reveal scroll lands on it. */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onGoogle}
        data-section-focus
        data-testid="step4-auth-google"
      >
        {t("google")}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email_label")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    data-testid="step4-auth-email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("password_label")}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    data-testid="step4-auth-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={pending}
            data-testid="step4-auth-submit"
            className="w-full"
          >
            {pending ? t("submit_working") : t("continue")}
          </Button>
        </form>
      </Form>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onMagicLink}
        data-testid="step4-auth-magic"
      >
        {t("magic_link")}
      </Button>

      {magicSent ? (
        <p
          className="text-sm text-foreground"
          role="status"
          data-testid="step4-auth-magic-sent"
        >
          {t("magic_sent")}
        </p>
      ) : null}

      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="step4-auth-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
