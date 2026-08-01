import type { Metadata } from "next";
import Link from "next/link";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { prisma } from "@/lib/db";

import { PhotoUploader } from "./_components/photo-uploader";
import { ProfileForm } from "./_components/profile-form";

export const metadata: Metadata = {
  title: "Profile · Instructor",
};

export default async function InstructorProfilePage() {
  const { instructorId } = await requireInstructor();

  const profile = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: {
      photo: true,
      bio: true,
      specialties: true,
      languages: true,
      active: true,
      acceptsSameDayIfBooked: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!profile) {
    // requireInstructor already guarantees the row exists; this is a
    // defensive fallback if the row was deleted between the gate and the
    // load.
    throw new Error("Instructor profile not found");
  }

  // Server-resolved gating flag — the client component renders the "Blob not
  // configured" notice when this is false instead of letting the action fail.
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return (
    <div
      data-testid="instructor-profile"
      className="mx-auto max-w-3xl space-y-12 px-6 py-12"
    >
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Profile
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          How bookers see you
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          The bio, specialties, languages and photo here power Step 3 of the
          booking funnel. Changes go live immediately.
        </p>
        <Link
          href="/instructor"
          data-testid="instructor-profile-back"
          className="inline-block text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        >
          ← Back to agenda
        </Link>
      </header>

      <section
        aria-labelledby="profile-photo-heading"
        className="space-y-4"
      >
        <h2
          id="profile-photo-heading"
          className="font-display text-2xl tracking-tight"
        >
          Photo
        </h2>
        <PhotoUploader
          currentPhoto={profile.photo}
          fallbackName={profile.user.name ?? profile.user.email}
          blobConfigured={blobConfigured}
        />
      </section>

      <section
        aria-labelledby="profile-form-heading"
        className="space-y-4"
      >
        <h2
          id="profile-form-heading"
          className="font-display text-2xl tracking-tight"
        >
          Bio and details
        </h2>
        <ProfileForm
          initial={{
            bio: profile.bio ?? "",
            specialties: profile.specialties,
            languages: profile.languages,
            active: profile.active,
            acceptsSameDayIfBooked: profile.acceptsSameDayIfBooked,
          }}
        />
      </section>
    </div>
  );
}
