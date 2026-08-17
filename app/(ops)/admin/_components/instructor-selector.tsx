"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InstructorOption = {
  id: string;
  name: string;
};

type Props = {
  instructors: InstructorOption[];
  selectedId: string;
  /** Preserved across the navigation so switching instructor keeps the month. */
  month: string;
};

/**
 * Switches whose calendar the admin is viewing/editing. Single-instructor MVP
 * shows one option; the panel is built for multi-instructor from day one.
 */
export function InstructorSelector({ instructors, selectedId, month }: Props) {
  const router = useRouter();

  // F-133: `items` is what makes the trigger show the instructor's name; without
  // it Base UI renders the raw value, which here is the cuid.
  const items = instructors.map((i) => ({ value: i.id, label: i.name }));

  return (
    <Select
      items={items}
      value={selectedId}
      onValueChange={(value) =>
        router.push(`/admin?instructor=${value}&month=${month}`)
      }
    >
      <SelectTrigger
        data-testid="admin-instructor-select"
        className="w-64"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {instructors.map((i) => (
          <SelectItem
            key={i.id}
            value={i.id}
            data-testid={`admin-instructor-option-${i.id}`}
          >
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
