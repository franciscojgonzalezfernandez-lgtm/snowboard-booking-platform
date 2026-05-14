import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — Snowboard Booking Platform",
};

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2">
        <h1
          className="font-[family-name:var(--font-display)] text-4xl tracking-tight"
          data-testid="login-title"
        >
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground">
          Email and password, magic link, or Google.
        </p>
      </div>

      <div className="mt-10">
        <LoginForm />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        By continuing you accept the{" "}
        <Link href="/" className="underline-offset-4 hover:underline">
          terms of service
        </Link>
        .
      </p>
    </main>
  );
}
