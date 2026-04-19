"use client";

import { SignIn } from "@clerk/nextjs";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function SignInPage() {
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
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            color: "#f1f5f9",
            fontSize: 36,
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
          }}>
            Welcome Back
          </h1>
          <p style={{
            color: "#94a3b8",
            fontSize: 16,
            margin: 0,
          }}>
            Sign in to continue to Face Attendance
          </p>
        </div>

        {/* Glassmorphism Card Wrapper */}
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
        }}>
          {/* Glow effect behind card */}
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

          {/* Glass Card */}
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
            <SignIn
              path="/sign-in"
              routing="path"
              appearance={{
                layout: {
                  socialButtonsPlacement: "top",
                  socialButtonsVariant: "blockButton",
                },
                variables: {
                  colorPrimary: "#0ea5e9",
                  colorBackground: "transparent",
                  colorInputBackground: "rgba(255, 255, 255, 0.04)",
                  colorInputText: "#f1f5f9",
                  colorText: "#e2e8f0",
                  colorTextSecondary: "#94a3b8",
                  colorNeutral: "#94a3b8",
                  borderRadius: "14px",
                  fontFamily: "'Outfit', sans-serif",
                },
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: { width: "100%", boxShadow: "none" },
                  card: { background: "transparent", boxShadow: "none", padding: "0", width: "100%" },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  socialButtonsBlockButton: {
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "14px",
                    color: "#e2e8f0",
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all 0.2s ease",
                  },
                  socialButtonsBlockButtonText: { color: "#e2e8f0" },
                  dividerLine: { background: "rgba(255, 255, 255, 0.06)" },
                  dividerText: { color: "#64748b", fontSize: "12px" },
                  formFieldLabel: { color: "#cbd5e1", fontSize: "13px", fontWeight: 500, marginBottom: "6px" },
                  formFieldInput: {
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "14px",
                    color: "#f1f5f9",
                    padding: "14px 16px",
                    fontSize: "15px",
                    transition: "all 0.2s ease",
                  },
                  formButtonPrimary: {
                    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                    border: "none",
                    borderRadius: "14px",
                    padding: "14px 0",
                    fontSize: "15px",
                    fontWeight: 600,
                    boxShadow: "0 8px 32px rgba(14, 165, 233, 0.3)",
                    transition: "all 0.2s ease",
                  },
                  footerActionText: { color: "#94a3b8", fontSize: "13px" },
                  footerActionLink: { color: "#0ea5e9", fontWeight: 600, fontSize: "13px" },
                  formFieldInputShowPasswordButton: { color: "#64748b" },
                  alert: {
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.15)",
                    borderRadius: "12px",
                    color: "#fca5a5",
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Footer */}
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
