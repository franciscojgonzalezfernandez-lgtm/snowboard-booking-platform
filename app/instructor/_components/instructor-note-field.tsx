"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { INSTRUCTOR_NOTE_MAX } from "@/lib/schemas/instructor-note";

import { setInstructorNote } from "../actions";

// F-065 AC: debounced auto-save, 1.5s after the last keystroke.
const DEBOUNCE_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Inline, internal-only note editor for a COMPLETED booking. Auto-saves the
 * trimmed value 1.5s after the instructor stops typing (and immediately on
 * blur, so navigating away never drops an edit). The server action re-validates
 * ownership + status; this island only owns the debounce + status text.
 */
export function InstructorNoteField({
  bookingId,
  initialNote,
}: {
  bookingId: string;
  initialNote: string;
}) {
  const [value, setValue] = useState(initialNote);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last value the server confirmed — guards against redundant saves (e.g. a
  // blur right after a debounce already flushed the same text).
  const savedValue = useRef(initialNote);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function save(next: string) {
    if (next === savedValue.current) return;
    setState("saving");
    const result = await setInstructorNote(bookingId, next);
    if (!mounted.current) return;
    if (result.ok) {
      savedValue.current = next;
      setState("saved");
    } else {
      setState("error");
    }
  }

  function scheduleSave(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), DEBOUNCE_MS);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setValue(next);
    setState(next === savedValue.current ? "saved" : "idle");
    scheduleSave(next);
  }

  function handleBlur() {
    if (timer.current) clearTimeout(timer.current);
    void save(value);
  }

  const statusLabel =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Save failed — retry"
          : " ";

  return (
    <div className="space-y-1.5" data-testid="instructor-note">
      <label
        htmlFor={`note-${bookingId}`}
        className="block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
      >
        Instructor note · internal
      </label>
      <Textarea
        id={`note-${bookingId}`}
        data-testid="instructor-note-input"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={INSTRUCTOR_NOTE_MAX}
        rows={2}
        placeholder="Progress, real level observed, preferences, warnings…"
      />
      <p
        data-testid="instructor-note-status"
        data-state={state}
        aria-live="polite"
        className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {statusLabel}
      </p>
    </div>
  );
}
