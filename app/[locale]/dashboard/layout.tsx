import { Toaster } from "@/components/ui/sonner";

/**
 * Dashboard-scoped layout. Mounts the sonner <Toaster /> so the F-064b phone
 * edit (and any future dashboard mutations) can surface feedback toasts —
 * the toaster is intentionally not global to keep the public marketing routes
 * free of client toast machinery.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
