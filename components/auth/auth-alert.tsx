"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type AuthAlertProps = {
  message: string;
  variant?: "error" | "success";
};

export function AuthAlert({ message, variant = "error" }: AuthAlertProps) {
  const isError = variant === "error";

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={[
            "flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] font-semibold leading-6",
            isError
              ? "border-rose-100 bg-rose-50 text-rose-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-800",
          ].join(" ")}
        >
          {isError ? (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          )}
          <span>{message}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
