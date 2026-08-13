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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/client";

type Mode = "signin" | "signup";

type LoginFormProps = {
  locale: string;
  callbackURL?: string;
};

export function LoginForm({ locale, callbackURL }: LoginFormProps) {
  const t = useTranslations("login");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  // F-128: when set, the email whose address needs confirming — swaps the form
  // for the "confirm your email" state. Under F-122 `requireEmailVerification`,
  // an email+password account can no longer get a session (sign-up creates none;
  // sign-in 403s EMAIL_NOT_VERIFIED) until the inbox link is clicked, so pushing
  // to `destination` after submit would silently drop the user, unauthenticated,
  // with no explanation.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [verifyResent, setVerifyResent] = useState(false);

  const credentialsSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("validation_email_invalid")),
        password: z.string().min(8, t("validation_password_min")),
        name: z.string().min(1, t("validation_name_required")).optional(),
      }),
    [t],
  );

  type CredentialsValues = z.infer<typeof credentialsSchema>;

  const form = useForm<CredentialsValues>({
    resolver: zodResolver(
      mode === "signup"
        ? credentialsSchema.required({ name: true })
        : credentialsSchema.omit({ name: true }),
    ),
    defaultValues: { email: "", password: "", name: "" },
  });

  const destination = callbackURL ?? `/${locale}`;

  function onSubmit(values: CredentialsValues) {
    setError(null);
    setVerifyResent(false);
    startTransition(async () => {
      if (mode === "signup") {
        // Under `requireEmailVerification`, sign-up creates no session and
        // returns a generic success even for an existing email (anti-
        // enumeration). Any error here is a real failure (weak password, rate
        // limit, delivery); surface it. `callbackURL` threads through so the
        // verification link returns here already signed in.
        const signUp = await authClient.signUp.email({
          email: values.email,
          password: values.password,
          name: values.name ?? values.email.split("@")[0]!,
          callbackURL: destination,
        });
        if (signUp.error) {
          setError(signUp.error.message ?? t("error_fallback"));
          return;
        }
      }

      // Resolve the real state with a sign-in (sign-up tells us nothing now).
      const signIn = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: destination,
      });
      if (!signIn.error) {
        router.push(destination);
        router.refresh();
        return;
      }
      // Correct password but unverified address (new account, or one that never
      // confirmed): Better Auth 403s EMAIL_NOT_VERIFIED and re-sends the link
      // (`sendOnSignIn`). Show the confirm state instead of a raw error.
      const notVerified =
        signIn.error.code === "EMAIL_NOT_VERIFIED" ||
        signIn.error.status === 403;
      if (notVerified) {
        setVerifyEmail(values.email);
        return;
      }
      // Wrong password on an existing account, or a passwordless (Google/magic)
      // account: in sign-up mode nudge toward those methods; in sign-in mode
      // surface the sign-in error.
      setError(
        mode === "signup"
          ? t("error_existing_account")
          : (signIn.error.message ?? t("error_fallback")),
      );
    });
  }

  async function onResendVerification() {
    if (!verifyEmail) return;
    setError(null);
    setVerifyResent(false);
    const result = await authClient.sendVerificationEmail({
      email: verifyEmail,
      callbackURL: destination,
    });
    if (result.error) {
      setError(result.error.message ?? t("error_fallback"));
      return;
    }
    setVerifyResent(true);
  }

  async function onGoogle() {
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: destination,
    });
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
      callbackURL: destination,
    });
    if (result.error) {
      if (result.error.code === "MAGIC_LINK_DELIVERY_FAILED") {
        setError(t("error_magic_link_delivery_failed"));
      } else {
        setError(result.error.message ?? t("error_fallback"));
      }
      return;
    }
    setMagicSent(true);
  }

  // F-128: address needs confirming before a session can exist. Replace the
  // form with a focused "check your inbox" panel + resend. Google and magic link
  // never reach here (both arrive pre-verified).
  if (verifyEmail) {
    return (
      <div className="space-y-4" data-testid="login-verify">
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
          data-testid="login-verify-resend"
        >
          {t("verify_email_resend")}
        </Button>
        {verifyResent ? (
          <p
            className="text-sm text-foreground"
            role="status"
            data-testid="login-verify-resent"
          >
            {t("verify_email_resent")}
          </p>
        ) : null}
        {error ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            data-testid="auth-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        aria-label={t("aria_tablist")}
      >
        {/*
          Editorial override: shadcn's default Tabs renders a rounded card
          background with a "popped" active state — too SaaS-generic for
          this brand. Use the built-in `variant="line"` (transparent bg +
          bottom-bar accent on the active trigger) and add uppercase
          tracking + bold weight to match the rest of the auth/booking
          chrome. Triggers carry min-h-11 directly so they clear the
          44px mobile touch target (Base UI doesn't stretch nested
          triggers when the list uses grid layout).
        */}
        <TabsList
          variant="line"
          className="grid h-12 w-full grid-cols-2 border-b border-foreground/15"
        >
          <TabsTrigger
            value="signin"
            data-testid="tab-signin"
            className="h-full min-h-11 text-[11px] font-bold uppercase tracking-[0.18em]"
          >
            {t("tab_signin")}
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            data-testid="tab-signup"
            className="h-full min-h-11 text-[11px] font-bold uppercase tracking-[0.18em]"
          >
            {t("tab_signup")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {mode === "signup" ? (
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name_label")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      data-testid="input-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

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
                    data-testid="input-email"
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
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    data-testid="input-password"
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
            data-testid="submit-credentials"
            className="w-full"
          >
            {pending
              ? t("submit_working")
              : mode === "signup"
                ? t("submit_signup")
                : t("submit_signin")}
          </Button>
        </form>
      </Form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          data-testid="btn-google"
        >
          {t("google")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onMagicLink}
          data-testid="btn-magic-link"
        >
          {t("magic_link")}
        </Button>
      </div>

      {magicSent ? (
        <p
          className="text-sm text-foreground"
          role="status"
          data-testid="magic-sent"
        >
          {t("magic_sent")}
        </p>
      ) : null}

      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="auth-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
