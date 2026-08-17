"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { InstructorOption } from "../../_components/instructor-selector";

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

  // F-133: without `items` the trigger renders the raw value, which here is the
  // instructor's cuid — the operator was reading `cmpaddwe10002…` instead of a
  // name. One array drives both the options and the trigger label.
  const items = [
    { value: "all", label: "All instructors" },
    ...instructors.map((i) => ({ value: i.id, label: i.name })),
  ];

  return (
    <Select items={items} value={selectedId} onValueChange={onChange}>
      <SelectTrigger
        data-testid="cancel-day-instructor-select"
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            data-testid={`cancel-day-instructor-option-${item.value}`}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
