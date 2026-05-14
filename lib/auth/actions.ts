"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";

export async function getSessionAction() {
  return auth.api.getSession({ headers: await headers() });
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

const SignInEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signInEmailAction(formData: FormData) {
  const parsed = SignInEmailSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  return auth.api.signInEmail({ headers: await headers(), body: parsed });
}

const SignUpEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function signUpEmailAction(formData: FormData) {
  const parsed = SignUpEmailSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  return auth.api.signUpEmail({ headers: await headers(), body: parsed });
}

const MagicLinkSchema = z.object({
  email: z.string().email(),
  callbackURL: z.string().optional(),
});

export async function signInMagicLinkAction(formData: FormData) {
  const callbackRaw = formData.get("callbackURL");
  const parsed = MagicLinkSchema.parse({
    email: formData.get("email"),
    callbackURL: typeof callbackRaw === "string" ? callbackRaw : undefined,
  });
  return auth.api.signInMagicLink({ headers: await headers(), body: parsed });
}

const SignInSocialSchema = z.object({
  provider: z.enum(["google"]),
  callbackURL: z.string().optional(),
});

export async function signInSocialAction(formData: FormData) {
  const callbackRaw = formData.get("callbackURL");
  const parsed = SignInSocialSchema.parse({
    provider: formData.get("provider"),
    callbackURL: typeof callbackRaw === "string" ? callbackRaw : undefined,
  });
  const res = await auth.api.signInSocial({
    headers: await headers(),
    body: parsed,
  });
  if (res?.url) redirect(res.url);
  return res;
}
