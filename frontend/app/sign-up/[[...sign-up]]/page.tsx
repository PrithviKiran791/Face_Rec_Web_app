"use client";

import { SignUp } from "@clerk/nextjs";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function SignUpPage() {
  return (
    <AuroraBackground animationSpeed={20}>
      {/* Force visibility on Clerk's sub-components */}
      <style dangerouslySetInnerHTML={{ __html: `
        .cl-headerTitle, .cl-headerSubtitle, .cl-formFieldLabel, .cl-formFieldActionText, .cl-formFieldHintText, .cl-identityPreviewText {
          color: white !important;
        }
        .cl-formResendCodeLink, .cl-footerActionLink {
          color: white !important;
          font-weight: 700 !important;
          text-decoration: underline !important;
        }
        .cl-otpCodeFieldInput {
          color: white !important;
          background-color: rgba(255,255,255,0.1) !important;
          border-color: rgba(255,255,255,0.3) !important;
        }
        .cl-dividerText { color: #94a3b8 !important; }
        .cl-socialButtonsBlockButtonText { color: white !important; }
      `}} />
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

          {/* Glass Card */}
          <div style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 28,
            padding: 0, /* Let Clerk handle inner spacing */
            overflow: "hidden",
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
              appearance={{
                elements: {
                  card: {
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                    padding: "40px 36px 32px",
                  },
                  headerTitle: { color: "#ffffff", fontWeight: 700 },
                  headerSubtitle: { color: "#cbd5e1" },
                  socialButtonsBlockButton: {
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.1)" }
                  },
                  socialButtonsBlockButtonText: { color: "#ffffff" },
                  dividerText: { color: "#94a3b8" },
                  dividerLine: { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                  formFieldLabel: { color: "#cbd5e1", fontWeight: 500 },
                  formFieldInput: {
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    "&::placeholder": { color: "rgba(255, 255, 255, 0.4)" },
                    "&:focus": { border: "1px solid var(--accent)" }
                  },
                  formButtonPrimary: {
                    backgroundColor: "var(--accent)",
                    color: "#ffffff",
                    "&:hover": { opacity: 0.9 }
                  },
                  footerActionText: { color: "#94a3b8" },
                  footerActionLink: { color: "var(--accent)", fontWeight: 600 },
                  identityPreviewText: { color: "#ffffff" },
                  identityPreviewEditButtonIcon: { color: "#ffffff" },
                  otpCodeFieldInput: {
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    fontSize: "20px",
                    fontWeight: 600
                  },
                  formResendCodeLink: {
                    color: "var(--accent)",
                    fontWeight: 600,
                    "&:hover": { opacity: 0.8 }
                  },
                  formFieldActionText: { color: "#ffffff" },
                  formFieldHintText: { color: "#ffffff" }
                }
              }}
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
