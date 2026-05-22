"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { voidActiveDraft } from "./actions";

export type DraftSnapshot = {
  bookingId: string;
  clientSecret: string;
  totalPriceCents: number;
};

type GuardContextValue = {
  draft: DraftSnapshot | null;
  registerDraft: (snapshot: DraftSnapshot) => void;
  clearDraft: () => void;
  requestEdit: (proceed: () => void) => void;
};

const GuardContext = createContext<GuardContextValue | null>(null);

export function useDraftGuard(): GuardContextValue {
  const ctx = useContext(GuardContext);
  if (!ctx) {
    throw new Error(
      "useDraftGuard must be used within a <DraftGuardProvider>",
    );
  }
  return ctx;
}

type Props = {
  children: React.ReactNode;
};

export function DraftGuardProvider({ children }: Props) {
  const t = useTranslations("reservar.dirty");
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);
  const [pendingEdit, setPendingEdit] = useState<(() => void) | null>(null);
  const [pending, startTransition] = useTransition();
  const [voidError, setVoidError] = useState<string | null>(null);
  const draftRef = useRef<DraftSnapshot | null>(null);

  const registerDraft = useCallback((snapshot: DraftSnapshot) => {
    draftRef.current = snapshot;
    setDraft(snapshot);
  }, []);

  const clearDraft = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
    setPendingEdit(null);
    setVoidError(null);
  }, []);

  const requestEdit = useCallback((proceed: () => void) => {
    // No active draft → mutation is free. Most clicks land here on the
    // pre-draft sections, so the dialog never opens.
    if (!draftRef.current) {
      proceed();
      return;
    }
    // Stash the would-be mutation. Confirm in the dialog runs it after
    // Stripe cancels the PaymentIntent; cancel discards it.
    setPendingEdit(() => proceed);
  }, []);

  const handleConfirm = useCallback(() => {
    const snapshot = draftRef.current;
    const proceed = pendingEdit;
    if (!snapshot || !proceed) {
      setPendingEdit(null);
      return;
    }
    setVoidError(null);
    startTransition(async () => {
      const result = await voidActiveDraft(snapshot.bookingId);
      if (!result.ok) {
        setVoidError(t(`error_${result.error.toLowerCase()}` as const));
        return;
      }
      draftRef.current = null;
      setDraft(null);
      setPendingEdit(null);
      proceed();
    });
  }, [pendingEdit, t]);

  const handleCancel = useCallback(() => {
    setPendingEdit(null);
    setVoidError(null);
  }, []);

  const value = useMemo<GuardContextValue>(
    () => ({ draft, registerDraft, clearDraft, requestEdit }),
    [draft, registerDraft, clearDraft, requestEdit],
  );

  return (
    <GuardContext.Provider value={value}>
      {children}
      <Dialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent data-testid="dirty-edit-dialog">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>
          {voidError ? (
            <p
              data-testid="dirty-edit-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {voidError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="dirty-edit-cancel"
              onClick={handleCancel}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              data-testid="dirty-edit-confirm"
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? t("confirm_working") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}
