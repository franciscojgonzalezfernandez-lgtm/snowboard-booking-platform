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
 * - Email+password (F-122): with `requireEmailVerification` on, a password
 *   account can no longer hold a slot until its address is confirmed, so this
 *   path is no longer fully on-page — it becomes a round-trip to the inbox like
 *   magic link (accepted trade-off, D-2026-07-28). `signUp` now returns a
 *   generic success for an existing email too (anti-enumeration) and never
 *   auto-signs-in, so we resolve the real state with a follow-up `signIn`:
 *     · signIn ok               → verified, correct password → refresh to pay
 *     · signIn EMAIL_NOT_VERIFIED → new or unverified account → "confirm email"
 *     · signIn invalid          → existing account, wrong password / passwordless
 *   The verification link carries `callbackURL`, so confirming returns the
 *   booker to this funnel URL (draft in the query string) already signed in.
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
  // F-122: when set, the email whose address needs confirming — swaps the auth
  // form for the "confirm your email" state with a resend control.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [verifyResent, setVerifyResent] = useState(false);

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
    setVerifyResent(false);
    startTransition(async () => {
      const name = email.split("@")[0] || email;
      // Try to provision the account. Under `requireEmailVerification`, sign-up
      // never creates a session and returns a generic success even when the
      // email already exists (anti-enumeration), so it can no longer detect
      // "already exists" — any error here is a real failure (weak password,
      // rate limit, delivery) and must surface. `callbackURL` is threaded so the
      // verification link returns to this funnel URL with the draft intact.
      const signUp = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL,
      });
      if (signUp.error) {
        setError(signUp.error.message ?? t("error_fallback"));
        return;
      }

      // Resolve the real account state. Sign-up succeeding tells us nothing
      // (new vs existing look identical), so sign in to branch.
      const signIn = await authClient.signIn.email({
        email,
        password,
        callbackURL,
      });
      if (!signIn.error) {
        // Existing, verified, correct password. Session cookie is set — re-render
        // the server component in place so Section 4 becomes payment, no nav.
        router.refresh();
        return;
      }
      // Correct password but the address is unverified (new account we just
      // created, or an existing one that never confirmed). Better Auth returns
      // 403 EMAIL_NOT_VERIFIED and re-sends the link (`sendOnSignIn`); show the
      // confirm-your-email state instead of flipping to payment.
      const notVerified =
        signIn.error.code === "EMAIL_NOT_VERIFIED" ||
        signIn.error.status === 403;
      if (notVerified) {
        setVerifyEmail(email);
        return;
      }
      // Existing account whose password did not authenticate: wrong password, or
      // it was created via Google / magic link and has none. Nudge toward the
      // passwordless methods rather than a bare "invalid password".
      setError(t("error_existing_account"));
    });
  }

  async function onResendVerification() {
    if (!verifyEmail) return;
    setError(null);
    setVerifyResent(false);
    const result = await authClient.sendVerificationEmail({
      email: verifyEmail,
      callbackURL,
    });
    if (result.error) {
      setError(result.error.message ?? t("error_fallback"));
      return;
    }
    setVerifyResent(true);
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

  // F-122: address needs confirming before the slot can be held. Replace the
  // auth methods with a focused "check your inbox" panel + resend. Google and
  // magic link never reach here (both arrive pre-verified).
  if (verifyEmail) {
    return (
      <div
        className="mt-6 space-y-4"
        data-testid="step4-auth-verify"
        data-section-focus
      >
        <p className="text-base font-medium text-foreground">
          {t("verify_email_title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("verify_email_body", { email: verifyEmail })}
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onResendVerification}
          data-testid="step4-auth-verify-resend"
        >
          {t("verify_email_resend")}
        </Button>
        {verifyResent ? (
          <p
            className="text-sm text-foreground"
            role="status"
            data-testid="step4-auth-verify-resent"
          >
            {t("verify_email_resent")}
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
