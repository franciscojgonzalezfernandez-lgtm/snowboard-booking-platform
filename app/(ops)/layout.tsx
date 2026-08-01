import {
  RootAnalytics,
  rootBodyClassName,
  rootMetadata,
} from "@/app/root-shell";
import "@/app/globals.css";

// Root layout for the operator surface — /admin and /instructor, plus the
// Sentry verification page. These live outside `[locale]` and are English only
// (see CLAUDE.md § Routing), so the lang is a constant.
//
// F-124: this is the second of two root layouts. Splitting them is what lets the
// public tree state its locale statically instead of resolving it from the
// request, which had been marking every route in the app dynamic.

export const metadata = rootMetadata;

export default function OpsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={rootBodyClassName}>
        {children}
        <RootAnalytics />
      </body>
    </html>
  );
}
