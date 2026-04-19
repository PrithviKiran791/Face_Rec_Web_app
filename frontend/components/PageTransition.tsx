"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";

const variants = {
  inactive: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: 'easeInOut'
    },
  },
  out: {
    opacity: 0,
    y: -100,
    transition: {
      duration: 0.6,
      ease: 'easeInOut'
    }
  },
  in: {
    y: 100,
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: 'easeInOut'
    }
  },
};

export default function PageTransition({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          variants={!shouldReduceMotion ? variants : {}}
          initial="in"
          animate="inactive"
          exit="out"
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
