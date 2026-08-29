import React from "react";
import { describe, expect, test } from "vitest";
import { render } from "@react-email/render";

import { BookingOpsNotifEmail } from "./booking-ops-notif";

const baseProps = {
  instructorName: "Lara",
  bookingDateLabel: "Saturday, 5 December 2026",
  anchorTime: "11:00",
  bookingDurationLabel: "1 hour",
  attendeeCount: 2,
  bookerName: "Lara Tester",
  bookerEmail: "lara@example.test",
  totalLabel: "CHF 110.00",
};

describe("booking-ops-notif email template — snapshot", () => {
  test("renders the new-booking ops notification", async () => {
    const html = await render(<BookingOpsNotifEmail {...baseProps} />, {
      pretty: true,
    });
    expect(html).toMatchSnapshot();
  });
});
