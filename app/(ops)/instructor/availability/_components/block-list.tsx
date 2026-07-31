import { DeleteBlockButton } from "./delete-block-button";

export type BlockRow = {
  id: string;
  dateLabel: string;
  startLabel: string;
  endLabel: string;
  hasActiveBooking: boolean;
};

type Props = {
  rows: BlockRow[];
};

export function BlockList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p
        data-testid="availability-list-empty"
        className="text-sm text-muted-foreground"
      >
        No upcoming availability windows. Add one above to start accepting
        bookings.
      </p>
    );
  }

  return (
    <ul
      data-testid="availability-list"
      className="divide-y divide-input border-y border-input"
    >
      {rows.map((row) => (
        <li
          key={row.id}
          data-testid="availability-list-item"
          data-block-id={row.id}
          className="flex items-center justify-between gap-4 py-4"
        >
          <div className="space-y-0.5">
            <p className="font-display text-base tracking-tight">
              {row.dateLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.startLabel} – {row.endLabel}
            </p>
            {row.hasActiveBooking ? (
              <p
                data-testid="availability-has-booking"
                className="text-xs font-medium text-muted-foreground"
              >
                Has a booking — cancel it before deleting this window.
              </p>
            ) : null}
          </div>
          <DeleteBlockButton
            blockId={row.id}
            hasActiveBooking={row.hasActiveBooking}
          />
        </li>
      ))}
    </ul>
  );
}
