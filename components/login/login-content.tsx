"use client";

import { motion } from "framer-motion";
import { LoginForm } from "@/components/login/login-form";
import {
  fadeUpItem,
  staggerContainer,
} from "@/components/login/login-motion";

export function LoginContent() {
  return (
    <motion.div
      className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.img
        src="/logo.svg"
        alt="Hesapisleri"
        variants={fadeUpItem}
        className="h-auto w-56 max-w-[80vw] brightness-0 invert drop-shadow-lg filter"
      />

      <motion.h1
        variants={fadeUpItem}
        className="mt-5 flex items-center gap-2 text-3xl font-bold tracking-tight text-white drop-shadow-md"
      >
        Hoş geldiniz!
        <motion.span
          aria-hidden
          className="inline-block"
          animate={{ rotate: [0, 14, -8, 14, 0] }}
          transition={{
            duration: 1.2,
            delay: 0.9,
            ease: "easeInOut",
          }}
        >
          👋
        </motion.span>
      </motion.h1>

      <motion.p
        variants={fadeUpItem}
        className="mt-3 max-w-sm text-center text-sm text-white/80"
      >
        Hesapişleri ile işletmenizi kolayca yönetin.
      </motion.p>

      <LoginForm />

      <motion.p
        variants={fadeUpItem}
        className="absolute bottom-4 mt-4 text-center text-xs text-white/80"
      >
        &copy; {new Date().getFullYear()} HESAPİŞLERİ.COM — TAMPAZAR ELEKTRONİK TİCARET SANAYİ LTD. ŞTİ.
      </motion.p>
    </motion.div>
  );
}
