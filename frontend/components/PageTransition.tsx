"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";

const variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    },
  },
};

export default function PageTransition({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          variants={!shouldReduceMotion ? variants : {}}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
