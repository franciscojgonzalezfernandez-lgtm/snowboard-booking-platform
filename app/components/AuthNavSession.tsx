"use client";

import { useRouter } from "@/i18n/navigation";
import { authClient, useSession } from "@/lib/auth/client";
import { AuthNavLinks } from "./AuthNavLinks";

type AuthNavSessionProps = {
  /** See `AuthNav` — pre-resolution state, only the dashboard passes `true`. */
  initialSignedIn: boolean;
};

/**
 * The half of the desktop auth CTA that actually talks to Better Auth. Split
 * out in F-125 and loaded once the browser goes idle: the auth client is ~11 KB
 * gz that anonymous marketing traffic — which is nearly all of it — only needs
 * in order to be told it is still anonymous.
 */
export function AuthNavSession({ initialSignedIn }: AuthNavSessionProps) {
  const router = useRouter();
  const { data, isPending } = useSession();
  const signedIn = isPending ? initialSignedIn : !!data?.user;

  return (
    <AuthNavLinks
      signedIn={signedIn}
      onSignOut={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    />
  );
}
