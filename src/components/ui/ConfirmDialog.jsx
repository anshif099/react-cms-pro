import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone. Please confirm to proceed.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4 text-left">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-950/20 text-admin-danger rounded-lg flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-admin-secondary leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
