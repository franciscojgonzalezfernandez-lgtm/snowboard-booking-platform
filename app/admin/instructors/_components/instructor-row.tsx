"use client";

import { useState, useTransition } from "react";
import { Locale } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { deactivateInstructor, updateInstructor } from "../../actions";

const ALL_LOCALES: Locale[] = [Locale.en, Locale.de, Locale.es];

export type InstructorRowData = {
  id: string;
  name: string;
  email: string;
  bio: string;
  languages: Locale[];
  specialties: string[];
  active: boolean;
};

export function InstructorRow({ instructor }: { instructor: InstructorRowData }) {
  const [pending, startTransition] = useTransition();
  const [bio, setBio] = useState(instructor.bio);
  const [languages, setLanguages] = useState<Locale[]>(instructor.languages);
  const [active, setActive] = useState(instructor.active);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function save() {
    startTransition(async () => {
      const res = await updateInstructor({
        instructorId: instructor.id,
        bio,
        languages,
        active,
      });
      if (res.ok) {
        toast.success("Instructor updated.");
        return;
      }
      toast.error(
        res.error === "NOT_FOUND"
          ? "That instructor no longer exists."
          : "Could not update the instructor.",
      );
    });
  }

  function deactivate() {
    startTransition(async () => {
      const res = await deactivateInstructor({ instructorId: instructor.id });
      if (res.ok) {
        setActive(false);
        setConfirmOpen(false);
        toast.success("Instructor deactivated.");
        return;
      }
      toast.error("Could not deactivate the instructor.");
    });
  }

  return (
    <li
      data-testid={`instructor-row-${instructor.id}`}
      data-active={active}
      className="space-y-4 rounded-md border border-input p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-xl tracking-tight">{instructor.name}</p>
          <p className="text-xs text-muted-foreground">{instructor.email}</p>
        </div>
        {!active ? (
          <span
            data-testid={`instructor-inactive-${instructor.id}`}
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Inactive
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`bio-${instructor.id}`}>Bio</Label>
        <Textarea
          id={`bio-${instructor.id}`}
          data-testid={`instructor-edit-bio-${instructor.id}`}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-4">
          {ALL_LOCALES.map((locale) => (
            <label
              key={locale}
              className="flex items-center gap-2 text-sm uppercase tracking-wider"
            >
              <Checkbox
                data-testid={`instructor-edit-language-${instructor.id}-${locale}`}
                checked={languages.includes(locale)}
                onCheckedChange={(value) =>
                  setLanguages((prev) =>
                    value === true
                      ? [...prev, locale]
                      : prev.filter((l) => l !== locale),
                  )
                }
              />
              {locale}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          data-testid={`instructor-edit-active-${instructor.id}`}
          checked={active}
          onCheckedChange={(value) => setActive(value === true)}
        />
        Active
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-input pt-4">
        <Button
          type="button"
          data-testid={`instructor-save-${instructor.id}`}
          disabled={pending}
          onClick={save}
        >
          {pending ? "Saving…" : "Save"}
        </Button>

        {active ? (
          <Button
            type="button"
            variant="ghost"
            data-testid={`instructor-deactivate-${instructor.id}`}
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            Deactivate
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid={`instructor-deactivate-dialog-${instructor.id}`}>
          <DialogHeader>
            <DialogTitle>Deactivate {instructor.name}?</DialogTitle>
            <DialogDescription>
              They stop appearing in booking availability. Their bookings and
              history are preserved — this never deletes data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid={`instructor-deactivate-confirm-${instructor.id}`}
              onClick={deactivate}
              disabled={pending}
            >
              {pending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
