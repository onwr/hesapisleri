"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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

      <motion.p
        variants={fadeUpItem}
        className="mt-6 text-center text-[13px] text-slate-500"
      >
        Zaten hesabınız var mı?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
          Giriş yapın
        </Link>
      </motion.p>
    </motion.div>
  );
}
