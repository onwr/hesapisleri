"use client";

import { motion } from "framer-motion";
import { RegisterForm } from "@/components/register/register-form";
import {
  fadeUpItem,
  staggerContainer,
} from "@/components/login/login-motion";
import type { ComponentProps } from "react";

export type RegisterContentProps = ComponentProps<typeof RegisterForm>;

export function RegisterContent(props: RegisterContentProps) {
  const { trialDays, registrationEnabled } = props;

  return (
    <motion.div
      className="w-full"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >


      <motion.div variants={fadeUpItem} className="mt-6">
        <RegisterForm {...props} />
      </motion.div>
    </motion.div>
  );
}
