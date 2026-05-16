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

type Mode = "signin" | "signup";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

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

  const localeHome = `/${locale}`;

  function onSubmit(values: CredentialsValues) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email: values.email,
              password: values.password,
              name: values.name ?? values.email.split("@")[0]!,
            })
          : await authClient.signIn.email({
              email: values.email,
              password: values.password,
            });

      if (result.error) {
        setError(result.error.message ?? t("error_fallback"));
        return;
      }
      router.push(localeHome);
      router.refresh();
    });
  }

  async function onGoogle() {
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: localeHome,
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
      callbackURL: localeHome,
    });
    if (result.error) {
      setError(result.error.message ?? t("error_fallback"));
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label={t("aria_tablist")}
        className="grid grid-cols-2 gap-2 border-b border-border pb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          data-testid="tab-signin"
          onClick={() => setMode("signin")}
          className={
            "py-1 text-sm transition " +
            (mode === "signin"
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {t("tab_signin")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          data-testid="tab-signup"
          onClick={() => setMode("signup")}
          className={
            "py-1 text-sm transition " +
            (mode === "signup"
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {t("tab_signup")}
        </button>
      </div>

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
