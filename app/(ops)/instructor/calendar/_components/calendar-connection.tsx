"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { disconnectCalendar } from "../../actions";

const ERROR_COPY: Record<string, string> = {
  not_configured: "Calendar sync isn't configured yet. Contact the admin.",
  denied: "Connection cancelled.",
  state: "The connection expired. Please try again.",
  no_refresh_token:
    "Google didn't return offline access. Disconnect on your Google account, then reconnect.",
  exchange: "Could not complete the connection. Please try again.",
};

type Props = {
  connected: boolean;
  /** `?calendar_connected=1` / `?calendar_error=<code>` from the OAuth callback. */
  justConnected: boolean;
  errorCode: string | null;
};

export function CalendarConnection({ connected, justConnected, errorCode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function disconnect() {
    startTransition(async () => {
      await disconnectCalendar();
      toast.success("Google Calendar disconnected.");
      router.refresh();
    });
  }

  return (
    <section
      data-testid="calendar-connection"
      data-connected={connected}
      className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-input p-4"
    >
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Google Calendar
        </p>
        <p className="text-sm text-muted-foreground">
          {connected
            ? "Connected — confirmed classes sync to your calendar."
            : "Connect to mirror your confirmed classes onto your Google Calendar."}
        </p>
        {justConnected ? (
          <p className="text-sm text-foreground" data-testid="calendar-connect-success">
            Calendar connected.
          </p>
        ) : null}
        {errorCode ? (
          <p className="text-sm text-destructive" role="alert" data-testid="calendar-connect-error">
            {ERROR_COPY[errorCode] ?? "Something went wrong. Please try again."}
          </p>
        ) : null}
      </div>

      {connected ? (
        <Button
          type="button"
          variant="outline"
          data-testid="calendar-disconnect"
          disabled={pending}
          onClick={disconnect}
        >
          {pending ? "Disconnecting…" : "Disconnect"}
        </Button>
      ) : (
        // A real top-level navigation (form GET) so the connect route handler's
        // 302 to Google consent is followed by the browser — Link/client nav
        // can't hand off to an external redirect.
        <form action="/instructor/calendar/connect" method="get">
          <Button type="submit" data-testid="calendar-connect">
            Connect Google Calendar
          </Button>
        </form>
      )}
    </section>
  );
}
