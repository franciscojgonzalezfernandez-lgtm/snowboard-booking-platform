"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DiscountCodeForm } from "./discount-code-form";

export function CreateDiscountCodeDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        data-testid="discount-new"
        onClick={() => setOpen(true)}
      >
        New code
      </Button>
      <DialogContent data-testid="discount-create-dialog">
        <DialogHeader>
          <DialogTitle>New discount code</DialogTitle>
          <DialogDescription>
            A booker types this code in the step before payment to get a
            percentage or a fixed amount off the lesson.
          </DialogDescription>
        </DialogHeader>
        <DiscountCodeForm mode="create" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
