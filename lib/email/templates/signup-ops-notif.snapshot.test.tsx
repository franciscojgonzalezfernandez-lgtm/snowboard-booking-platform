import React from "react";
import { describe, expect, test } from "vitest";
import { render } from "@react-email/render";

import { SignupOpsNotifEmail } from "./signup-ops-notif";

const baseProps = {
  email: "new.rider@example.test",
  name: "New Rider",
  method: "google" as const,
  locale: "de" as const,
  total: 42,
};

describe("signup-ops-notif email template — snapshot", () => {
  test("renders the new-account ops notification", async () => {
    const html = await render(<SignupOpsNotifEmail {...baseProps} />, {
      pretty: true,
    });
    expect(html).toMatchSnapshot();
  });

  test("renders an em dash when the account has no name", async () => {
    const html = await render(
      <SignupOpsNotifEmail {...baseProps} name={null} method="magic-link" />,
      { pretty: true },
    );
    expect(html).toMatchSnapshot();
  });
});
