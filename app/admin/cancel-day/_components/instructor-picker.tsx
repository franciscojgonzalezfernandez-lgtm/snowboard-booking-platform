"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InstructorOption = { id: string; name: string };

type Props = {
  instructors: InstructorOption[];
  /** `"all"` or an instructor id. */
  selectedId: string;
};

/**
 * Mirrors `<InstructorSelector>` from the admin calendar — value lives in the
 * URL so the preview stays bookmarkable / refresh-safe. Includes "All
 * instructors" so the owner can cancel a full day across the school in one
 * batch (the dominant F-079 use case: a storm closing everything).
 */
export function InstructorPicker({ instructors, selectedId }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(value: string | null) {
    if (value === null) return;
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("instructor");
    else next.set("instructor", value);
    router.push(`/admin/cancel-day?${next.toString()}`);
  }

  return (
    <Select value={selectedId} onValueChange={onChange}>
      <SelectTrigger
        data-testid="cancel-day-instructor-select"
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" data-testid="cancel-day-instructor-option-all">
          All instructors
        </SelectItem>
        {instructors.map((i) => (
          <SelectItem
            key={i.id}
            value={i.id}
            data-testid={`cancel-day-instructor-option-${i.id}`}
          >
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
