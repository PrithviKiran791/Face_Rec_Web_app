"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function LoginPage() {
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
        .cl-internal-1dauvpw {
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

        /* ── Footer / Already have account ────────────────────────── */
        .cl-footerActionText {
          color: #94a3b8 !important;
        }

        .cl-footerActionLink {
          color: #0ea5e9 !important;
          font-weight: 600 !important;
        }

        /* Hide the default white footer background if it appears */
        .cl-internal-1hp6n60, .cl-footer {
          background: transparent !important;
          border: none !important;
        }

        /* ── Alert / error messages ────────────────────────────────── */
        .cl-alert {
          background: rgba(239, 68, 68, 0.08) !important;
          border: 1px solid rgba(239, 68, 68, 0.15) !important;
          border-radius: 10px !important;
        }

        .cl-alertText {
          color: #fca5a5 !important;
        }

        /* ── Secured by Clerk / Dev mode ─────────────────────────── */
        .cl-internal-b33umm,
        .cl-badge,
        [class*="__developmentMode"] {
          color: #f59e0b !important;
        }
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
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            color: "#f1f5f9",
            fontSize: 36,
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
          }}>
            Sign In
          </h1>
          <p style={{
            color: "#94a3b8",
            fontSize: 16,
            margin: 0,
          }}>
            Welcome to the Face Attendance System
          </p>
        </div>

        {/* Glassmorphism Card Wrapper */}
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
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
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 24,
            padding: "36px 32px 28px",
            overflow: "hidden",
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.04),
              0 20px 60px rgba(0, 0, 0, 0.5),
              0 0 80px rgba(14, 165, 233, 0.06),
              inset 0 1px 0 rgba(255, 255, 255, 0.06)
            `,
          }}>
            <SignIn
              path="/login"
              routing="path"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
              appearance={{
                variables: {
                  colorPrimary: "#0ea5e9",
                  colorBackground: "transparent",
                  colorInputBackground: "rgba(255, 255, 255, 0.06)",
                  colorInputText: "#f1f5f9",
                  colorText: "#e2e8f0",
                  colorTextSecondary: "#94a3b8",
                  colorNeutral: "#94a3b8",
                  borderRadius: "12px",
                  fontFamily: "'Outfit', sans-serif",
                },
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: { width: "100%", boxShadow: "none" },
                  card: { background: "transparent", boxShadow: "none", padding: "0", width: "100%" },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  footer: { background: "transparent" },
                }
              }}
            />
          </div>
        </div>

        {/* Register as Admin CTA */}
        <div style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "16px 24px",
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(14, 165, 233, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, marginBottom: 4 }}>
                New administrator?
              </p>
              <Link
                href="/sign-up"
                style={{
                  color: "#0ea5e9",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                Create an admin account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          color: "#475569",
          fontSize: 11,
          marginTop: 24,
          letterSpacing: "0.02em",
        }}>
          Face Attendance System · AI-Powered Security
        </p>
      </div>
    </AuroraBackground>
  );
}
