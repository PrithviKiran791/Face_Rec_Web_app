"use client";

import { SignUp } from "@clerk/nextjs";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function SignUpPage() {
  return (
    <AuroraBackground animationSpeed={20}>
      <div style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "'Outfit', sans-serif",
        padding: "24px",
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            color: "#f1f5f9",
            fontSize: 36,
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
          }}>
            Create Account
          </h1>
          <p style={{
            color: "#94a3b8",
            fontSize: 16,
            margin: 0,
          }}>
            Join the Face Attendance System
          </p>
        </div>

        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
        }}>
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "120%",
            height: "120%",
            background: "radial-gradient(ellipse at center, rgba(14, 165, 233, 0.15) 0%, rgba(37, 99, 235, 0.08) 40%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 0,
          }} />

          <div style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 28,
            padding: "40px 36px 32px",
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.05),
              0 20px 60px rgba(0, 0, 0, 0.5),
              0 0 80px rgba(14, 165, 233, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.06)
            `,
          }}>
            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/login"
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </div>

        <p style={{
          textAlign: "center",
          color: "#475569",
          fontSize: 11,
          marginTop: 32,
          letterSpacing: "0.02em",
        }}>
          Face Attendance System · AI-Powered Security
        </p>
      </div>
    </AuroraBackground>
  );
}
