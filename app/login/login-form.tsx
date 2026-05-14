"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

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

const credentialsSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  name: z.string().min(1, "Required").optional(),
});

type CredentialsValues = z.infer<typeof credentialsSchema>;

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const form = useForm<CredentialsValues>({
    resolver: zodResolver(
      mode === "signup"
        ? credentialsSchema.required({ name: true })
        : credentialsSchema.omit({ name: true }),
    ),
    defaultValues: { email: "", password: "", name: "" },
  });

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
        setError(result.error.message ?? "Authentication failed");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  async function onGoogle() {
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  }

  async function onMagicLink() {
    setError(null);
    const email = form.getValues("email");
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      form.setError("email", { message: "Enter a valid email first" });
      return;
    }
    setMagicSent(false);
    const result = await authClient.signIn.magicLink({
      email: parsed.data,
      callbackURL: "/",
    });
    if (result.error) {
      setError(result.error.message ?? "Magic link failed");
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Authentication mode"
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
          Sign in
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
          Create account
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
                  <FormLabel>Name</FormLabel>
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
                <FormLabel>Email</FormLabel>
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
                <FormLabel>Password</FormLabel>
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
              ? "Working…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
      </Form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or</span>
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
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onMagicLink}
          data-testid="btn-magic-link"
        >
          Email me a magic link
        </Button>
      </div>

      {magicSent ? (
        <p
          className="text-sm text-foreground"
          role="status"
          data-testid="magic-sent"
        >
          Magic link sent. Check the server logs in dev (Resend wiring lands in
          F-017).
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
