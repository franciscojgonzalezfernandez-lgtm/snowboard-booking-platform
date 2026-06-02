"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
} from "@/lib/schemas/instructor-profile";

import {
  removeInstructorPhotoAction,
  uploadInstructorPhotoAction,
} from "../../actions";

const UPLOAD_ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Pick an image file to upload.",
  INVALID_MIME: "Use a JPEG, PNG or WebP image.",
  TOO_LARGE: `Image is too large. Max ${Math.round(PHOTO_MAX_BYTES / 1_000_000)} MB.`,
  BLOB_NOT_CONFIGURED:
    "Photo storage is not configured yet. Ask the admin to provision Vercel Blob.",
  NOT_FOUND: "Your instructor profile was not found.",
  UPLOAD_FAILED: "Upload failed. Try again in a moment.",
};

const REMOVE_ERROR_COPY: Record<string, string> = {
  BLOB_NOT_CONFIGURED: UPLOAD_ERROR_COPY.BLOB_NOT_CONFIGURED!,
  NOT_FOUND: UPLOAD_ERROR_COPY.NOT_FOUND!,
};

type Props = {
  currentPhoto: string | null;
  fallbackName: string;
  blobConfigured: boolean;
};

export function PhotoUploader({
  currentPhoto,
  fallbackName,
  blobConfigured,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [photo, setPhoto] = useState<string | null>(currentPhoto);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!PHOTO_MIME_TYPES.includes(file.type as never)) {
      toast.error(UPLOAD_ERROR_COPY.INVALID_MIME!);
      e.target.value = "";
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast.error(UPLOAD_ERROR_COPY.TOO_LARGE!);
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("photo", file);
    startTransition(async () => {
      const res = await uploadInstructorPhotoAction(formData);
      if (res.ok) {
        setPhoto(res.photoUrl);
        toast.success("Photo updated.");
      } else {
        toast.error(UPLOAD_ERROR_COPY[res.error] ?? "Could not upload the photo.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeInstructorPhotoAction();
      if (res.ok) {
        setPhoto(null);
        toast.success("Photo removed.");
      } else {
        toast.error(REMOVE_ERROR_COPY[res.error] ?? "Could not remove the photo.");
      }
    });
  }

  const initials = fallbackName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4" data-testid="photo-uploader">
      <div className="flex items-center gap-5">
        <div className="size-24 overflow-hidden rounded-full border border-input bg-secondary/60">
          {photo ? (
            <Image
              src={photo}
              alt="Profile photo"
              width={96}
              height={96}
              sizes="96px"
              className="size-full object-cover"
              data-testid="photo-uploader-preview"
            />
          ) : (
            <div
              data-testid="photo-uploader-fallback"
              aria-hidden="true"
              className="flex size-full items-center justify-center text-base font-semibold tracking-wider"
            >
              {initials || "—"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="photo-uploader-pick"
            disabled={pending || !blobConfigured}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Working…" : photo ? "Replace photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button
              type="button"
              variant="outline"
              data-testid="photo-uploader-remove"
              disabled={pending || !blobConfigured}
              onClick={onRemove}
              className="text-destructive"
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept={PHOTO_MIME_TYPES.join(",")}
        onChange={onChange}
        data-testid="photo-uploader-input"
        className="sr-only"
        disabled={pending || !blobConfigured}
      />

      {!blobConfigured ? (
        <p
          data-testid="photo-uploader-not-configured"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900"
        >
          Photo storage is not configured yet. Bookers see your initials until
          the admin provisions Vercel Blob and the env var{" "}
          <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> is set.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          JPEG, PNG or WebP. Up to {Math.round(PHOTO_MAX_BYTES / 1_000_000)} MB.
        </p>
      )}
    </div>
  );
}
