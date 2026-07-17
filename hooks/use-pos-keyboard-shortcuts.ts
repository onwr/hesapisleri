"use client";

import { useEffect } from "react";

type PosKeyboardShortcutsOptions = {
  enabled: boolean;
  paymentOpen: boolean;
  checkingOut: boolean;
  cartEmpty: boolean;
  onFocusSearch: () => void;
  onFocusCustomer: () => void;
  onFocusBarcode: () => void;
  onCompleteSale: () => void;
  onClearCart: () => void;
  onCloseModal: () => void;
  onConfirmPayment: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.isContentEditable;
}

export function usePosKeyboardShortcuts({
  enabled,
  paymentOpen,
  checkingOut,
  cartEmpty,
  onFocusSearch,
  onFocusCustomer,
  onFocusBarcode,
  onCompleteSale,
  onClearCart,
  onCloseModal,
  onConfirmPayment,
}: PosKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (checkingOut) return;

      if (event.key === "Escape") {
        if (paymentOpen) {
          event.preventDefault();
          onCloseModal();
        }
        return;
      }

      if (paymentOpen) {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          onConfirmPayment();
        }
        return;
      }

      // Input yazarken F2/F4/F8 dışında global clear/barcode korunur
      const editing = isEditableTarget(event.target);

      if (event.key === "F2") {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        onFocusCustomer();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        onFocusBarcode();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        if (!cartEmpty) onCompleteSale();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Backspace" &&
        !editing
      ) {
        event.preventDefault();
        if (!cartEmpty) onClearCart();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    paymentOpen,
    checkingOut,
    cartEmpty,
    onFocusSearch,
    onFocusCustomer,
    onFocusBarcode,
    onCompleteSale,
    onClearCart,
    onCloseModal,
    onConfirmPayment,
  ]);
}
