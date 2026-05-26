import React from "react";
import { describe, expect, test } from "vitest";
import { render } from "@react-email/render";
import type { Locale } from "@prisma/client";

import { CancellationUserCreditEmail } from "./cancellation-user-credit";
import { CancellationUserForfeitEmail } from "./cancellation-user-forfeit";
import { CancellationOpsNotifEmail } from "./cancellation-ops-notif";

const LOCALES: Locale[] = ["en", "de", "es"] as Locale[];

const baseCreditProps = {
  bookerName: "Lara Tester",
  bookingDateLabel: "Saturday, 5 December 2026",
  bookingDurationLabel: "1 hour",
  instructorName: "Javi",
  creditAmountLabel: "CHF 110.00",
  creditExpiresAtLabel: "Tuesday, 5 December 2027",
  manageBookingUrl: "https://rideflumserberg.ch/en/dashboard",
  termsUrl: "https://rideflumserberg.ch/en/terms",
};

const baseForfeitProps = {
  bookerName: "Lara Tester",
  bookingDateLabel: "Saturday, 5 December 2026",
  bookingDurationLabel: "1 hour",
  instructorName: "Javi",
  hoursBeforeStart: 12,
  contactPhone: "+41 76 638 18 70",
  termsUrl: "https://rideflumserberg.ch/en/terms",
};

const baseOpsProps = {
  instructorName: "Javi",
  bookingDateLabel: "Saturday, 5 December 2026",
  bookingDurationLabel: "1 hour",
  anchorTime: "11:00",
  bookerName: "Lara Tester",
  bookerEmail: "lara@example.test",
  attendeeCount: 2,
};

async function snap(node: React.ReactElement): Promise<string> {
  return render(node, { pretty: true });
}

describe("cancellation email templates — snapshots", () => {
  for (const locale of LOCALES) {
    test(`cancellation-user-credit · ${locale}`, async () => {
      const html = await snap(
        <CancellationUserCreditEmail locale={locale} {...baseCreditProps} />,
      );
      expect(html).toMatchSnapshot();
    });

    test(`cancellation-user-forfeit · ${locale}`, async () => {
      const html = await snap(
        <CancellationUserForfeitEmail locale={locale} {...baseForfeitProps} />,
      );
      expect(html).toMatchSnapshot();
    });
  }

  for (const variant of ["credit", "forfeit"] as const) {
    test(`cancellation-ops-notif · ${variant}`, async () => {
      const html = await snap(
        <CancellationOpsNotifEmail
          locale={"en" as Locale}
          {...baseOpsProps}
          cancellationVariant={variant}
        />,
      );
      expect(html).toMatchSnapshot();
    });
  }
});
