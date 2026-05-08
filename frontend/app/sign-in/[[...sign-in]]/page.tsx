"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function SignInPage() {
  return (
    <AuroraBackground animationSpeed={20}>
      {/* Force dark theme on all Clerk sub-components */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Card & Root overrides ─────────────────────────────────── */
        .cl-card,
        .cl-cardBox,
        .cl-rootBox,
        .cl-signIn-root,
        .cl-internal-b33umm,
        .cl-internal-1dauvpw,
        .cl-internal-1hp6n60,
        div[class*="cl-internal-"] {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }

        /* ── Text colors ───────────────────────────────────────────── */
        .cl-headerTitle,
        .cl-headerSubtitle,
        .cl-formFieldLabel,
        .cl-formFieldActionText,
        .cl-formFieldHintText,
        .cl-identityPreviewText,
        .cl-formHeaderTitle,
        .cl-formHeaderSubtitle,
        .cl-headerBackRow,
        .cl-backLink,
        .cl-otpCodeFieldInput,
        .cl-formFieldInfoText,
        .cl-alertText,
        .cl-formField label,
        .cl-form label,
        .cl-footerActionText,
        p[class*="cl-"],
        span[class*="cl-"],
        h1[class*="cl-"],
        h2[class*="cl-"],
        h3[class*="cl-"] {
          color: #e2e8f0 !important;
        }

        /* ── Input fields ──────────────────────────────────────────── */
        .cl-formFieldInput,
        input[class*="cl-"] {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: #f1f5f9 !important;
          border-radius: 12px !important;
        }

        .cl-formFieldInput:focus,
        input[class*="cl-"]:focus {
          border-color: #0ea5e9 !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15) !important;
        }

        /* ── Buttons ───────────────────────────────────────────────── */
        .cl-formButtonPrimary {
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          box-shadow: 0 4px 20px rgba(14, 165, 233, 0.3) !important;
        }

        .cl-formButtonPrimary:hover {
          opacity: 0.9 !important;
        }

        /* ── Social buttons ────────────────────────────────────────── */
        .cl-socialButtonsBlockButton,
        .cl-socialButtonsIconButton {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #e2e8f0 !important;
          border-radius: 12px !important;
        }

        .cl-socialButtonsBlockButton:hover,
        .cl-socialButtonsIconButton:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .cl-socialButtonsBlockButtonText {
          color: #e2e8f0 !important;
        }

        /* ── Divider ───────────────────────────────────────────────── */
        .cl-dividerLine {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .cl-dividerText {
          color: #64748b !important;
        }

        /* ── Footer / Alternative options ──────────────────────────── */
        .cl-footerActionLink {
          color: #0ea5e9 !important;
        }
        .cl-footerActionLink:hover {
          color: #38bdf8 !important;
        }
        
        /* Hide Clerk watermark */
        .cl-footer,
        .cl-footerAction,
        .cl-internal-b3al4t {
          display: none !important;
        }
      `}} />

      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 10
      }}>
        {/* Custom Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "rgba(14, 165, 233, 0.1)",
            border: "1px solid rgba(14, 165, 233, 0.2)",
            borderRadius: "20px",
            color: "#38bdf8",
            fontSize: "12px",
            fontWeight: "600",
            letterSpacing: "0.5px",
            marginBottom: "24px"
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            SECURE ACCESS
          </div>
          
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: "800",
            color: "white",
            marginBottom: "16px",
            letterSpacing: "-1px"
          }}>
            Administrator Login
          </h1>
          <p style={{
            fontSize: "16px",
            color: "#94a3b8",
            maxWidth: "500px",
            margin: "0 auto",
            lineHeight: "1.6"
          }}>
            Authenticate to access the Face Attendance Control Panel
          </p>
        </div>

        {/* Glass Container for Clerk Component */}
        <div style={{
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "24px",
          padding: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          width: "100%",
          maxWidth: "400px"
        }}>
          <SignIn 
            appearance={{
              elements: {
                rootBox: {
                  width: "100%",
                },
                card: {
                  width: "100%",
                  padding: "32px 24px"
                }
              }
            }}
          />
        </div>

        {/* Custom Footer */}
        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link href="/sign-up" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            color: "#94a3b8",
            textDecoration: "none",
            fontSize: "14px",
            transition: "all 0.2s ease"
          }}>
            Need an account? <span style={{ color: "#38bdf8", fontWeight: "500" }}>Register here</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>

          <p style={{
            marginTop: "32px",
            fontSize: "12px",
            color: "#475569",
            fontWeight: "500",
            letterSpacing: "0.5px"
          }}>
            Face Attendance System · AI-Powered Security
          </p>
        </div>
      </div>
    </AuroraBackground>
  );
}
