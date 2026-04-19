"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { RetroGrid } from "@/components/RetroGrid";

export default function LandingPage() {
  const { userId } = useAuth();
  const [timestamp, setTimestamp] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    document.documentElement.classList.add('js-active');
    
    const updateTs = () => {
      const n = new Date();
      const pad = (x: number) => String(x).padStart(2, '0');
      setTimestamp(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}  ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`);
    };
    const interval = setInterval(updateTs, 1000);
    updateTs();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const animateCount = (el: HTMLElement) => {
      const target = +(el.dataset.target || 0);
      const duration = 1600;
      const start = performance.now();
      function step(now: number) {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };

    const statObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.count-num').forEach(el => animateCount(el as HTMLElement));
          statObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.stat-item').forEach(el => statObserver.observe(el));
  }, [isClient]);

  return (
    <main style={{ 
      backgroundColor: "#030712", 
      color: "#f0f4f8", 
      fontFamily: "'DM Sans', sans-serif",
      overflowX: "hidden",
      minHeight: "100vh",
      width: "100%",
      margin: 0,
      padding: 0
    }}>
      <RetroGrid />
      
      <div style={{ position: "relative", zIndex: 10 }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
          
          :root {
            --accent: #0ea5e9;
            --accent-glow: rgba(14, 165, 233, 0.18);
            --font-display: 'Syne', sans-serif;
          }

          .reveal { opacity: 1; transform: translateY(0); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
          
          .js-active .reveal { opacity: 0; transform: translateY(20px); }
          .js-active .reveal.visible { opacity: 1; transform: translateY(0); }

          @keyframes scan {
            0% { top: 0%; opacity: 1; }
            95% { top: 100%; opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }

          @keyframes pulse-dot {
            0%,100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.8); }
          }

          .scan-line {
            position: absolute;
            left: 0; right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent), transparent);
            animation: scan 3s ease-in-out infinite;
            top: 0;
            z-index: 2;
          }

          .face-box {
            position: absolute;
            border: 2px solid var(--accent);
            border-radius: 4px;
          }
        `}} />

        {/* NAV */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 3rem", height: "72px",
          background: "rgba(3, 7, 18, 0.45)", backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)"
        }}>
          <Link href="/" style={{ 
            fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 800, 
            color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" 
          }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 2s ease infinite" }} />
            FaceAttend
          </Link>
          <div style={{ display: "flex", gap: "2.5rem" }}>
            <a href="#how" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>How it works</a>
            <a href="#use-cases" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>Use cases</a>
          </div>
          <Link href={userId ? "/dashboard" : "/login"} style={{ 
            background: "var(--accent)", color: "#000", padding: "10px 24px", borderRadius: "8px", 
            fontSize: "14px", fontWeight: 600, textDecoration: "none", transition: "all 0.2s"
          }}>
            {userId ? "Go to Dashboard" : "Get started"}
          </Link>
        </nav>

        {/* HERO */}
        <section style={{ 
          position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", 
          alignItems: "center", justifyContent: "center", textAlign: "center", padding: "6rem 2rem 4rem" 
        }}>
          <div style={{
            position: "absolute", width: "600px", height: "600px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%, -60%)", pointerEvents: "none"
          }} />
          
          <div className="reveal" style={{ 
            display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(14, 165, 233, 0.08)",
            border: "1px solid rgba(14, 165, 233, 0.2)", color: "var(--accent)", padding: "5px 14px",
            borderRadius: "100px", fontSize: "12px", fontWeight: 500, marginBottom: "2rem"
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 2s ease infinite" }} />
            Real-time face recognition
          </div>

          <h1 className="reveal" style={{ 
            fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 7vw, 6rem)", fontWeight: 800, 
            lineHeight: 1, letterSpacing: "-2px", marginBottom: "1.5rem" 
          }}>
            Attendance,<br/>finally <em style={{ fontStyle: "normal", color: "var(--accent)" }}>automated</em>
          </h1>

          <p className="reveal" style={{ maxWidth: "560px", fontSize: "18px", fontWeight: 300, color: "#94a3b8", lineHeight: 1.7, marginBottom: "2.5rem" }}>
            Register once. Recognise always. A full-stack attendance system powered by InsightFace and live video — no ID cards, no sign-in sheets.
          </p>

          <div className="reveal" style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link href={userId ? "/dashboard" : "/login"} style={{ 
              background: "var(--accent)", color: "#000", padding: "14px 32px", borderRadius: "8px", 
              fontSize: "15px", fontWeight: 500, textDecoration: "none", boxShadow: "0 8px 32px rgba(14, 165, 233, 0.3)" 
            }}>{userId ? "Open Dashboard" : "Launch app"}</Link>
            <a href="#how" style={{ 
              color: "#fff", padding: "14px 32px", borderRadius: "8px", fontSize: "15px", 
              border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none" 
            }}>See how it works</a>
          </div>

          {/* HERO VISUAL */}
          <div className="reveal" style={{ marginTop: "4rem", position: "relative", width: "100%", maxWidth: "900px" }}>
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "1.5rem", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f57" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#febc2e" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#28c840" }} />
                <div style={{ position: "absolute", top: "14px", right: "14px", display: "flex", alignItems: "center", gap: "5px", color: "#ff4d6d", fontSize: "10px", fontWeight: 600 }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ff4d6d", animation: "pulse-dot 1s ease infinite" }} />
                  LIVE
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "1rem", minHeight: "260px" }}>
                <div style={{ background: "#030712", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="scan-line" />
                  <div style={{ position: "absolute", top: "10px", left: "10px", fontSize: "11px", color: "var(--accent)", background: "rgba(0,0,0,0.6)", padding: "3px 7px", borderRadius: "3px", fontFamily: "monospace" }}>
                    {timestamp}
                  </div>
                  
                  {/* Face Boxes with embedded Silhouettes */}
                  <div className="face-box" style={{ 
                    width: "110px", height: "130px", top: "30px", left: "80px",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                    paddingBottom: "15px"
                  }}>
                    {/* User Silhouette */}
                    <div style={{ position: "relative", width: "40px", height: "40px", background: "#1a2030", borderRadius: "50%", marginBottom: "5px" }} />
                    <div style={{ width: "70px", height: "30px", background: "#1a2030", borderRadius: "20px 20px 0 0" }} />
                    
                    <div style={{ 
                      position: "absolute", bottom: "-22px", left: 0, 
                      fontSize: "10px", fontWeight: 600, color: "var(--accent)", 
                      background: "rgba(14, 165, 233, 0.12)", padding: "2px 6px", borderRadius: "3px", 
                      whiteSpace: "nowrap" 
                    }}>
                      Sudheer · Student
                    </div>
                  </div>

                  <div className="face-box" style={{ 
                    width: "90px", height: "110px", top: "50px", right: "100px", borderColor: "#3b82f6",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                    paddingBottom: "12px"
                  }}>
                    {/* User Silhouette */}
                    <div style={{ position: "relative", width: "34px", height: "34px", background: "#1a2030", borderRadius: "50%", marginBottom: "4px" }} />
                    <div style={{ width: "60px", height: "24px", background: "#1a2030", borderRadius: "15px 15px 0 0" }} />
                    
                    <div style={{ 
                      position: "absolute", bottom: "-22px", left: 0, 
                      fontSize: "10px", fontWeight: 600, color: "#3b82f6", 
                      background: "rgba(59,130,246,0.12)", padding: "2px 6px", borderRadius: "3px", 
                      whiteSpace: "nowrap" 
                    }}>
                      Morgan · Teacher
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "11px", color: "#4a5a6a", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-display)" }}>Today's log</div>
                  {[
                    { name: "Sudheer", time: "08:16:19", role: "Student", status: "Present" },
                    { name: "Morgan Freeman", time: "08:28:06", role: "Teacher", status: "Present" },
                    { name: "Angelina Jolie", time: "09:12:38", role: "Student", status: "Late" }
                  ].map((log, i) => (
                    <div key={i} style={{ background: "#030712", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: i === 1 ? "rgba(59,130,246,0.12)" : "rgba(14, 165, 233, 0.12)", color: i === 1 ? "#3b82f6" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600 }}>{log.name.substring(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: 500 }}>{log.name}</div>
                        <div style={{ fontSize: "10px", color: "#4a5a6a" }}>{log.time} · {log.role}</div>
                      </div>
                      <div style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "100px", background: log.status === "Late" ? "rgba(245,158,11,0.12)" : "rgba(14, 165, 233, 0.12)", color: log.status === "Late" ? "#f59e0b" : "var(--accent)" }}>{log.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { num: "99", label: "Recognition accuracy", suffix: "%" },
            { num: "512", label: "Face embedding vector", suffix: "-D" },
            { num: "30", label: "Recognition latency", prefix: "<", suffix: "ms" },
            { num: "0", label: "Retraining needed", suffix: "×" }
          ].map((stat, i) => (
            <div key={i} className="stat-item reveal" style={{ background: "#030712", padding: "2rem", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 800, color: "#fff" }}>
                {stat.prefix}<span className="count-num" data-target={stat.num}>0</span><span style={{ color: "var(--accent)" }}>{stat.suffix}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#7a8a9a" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <section id="how" style={{ padding: "7rem 3rem", background: "rgba(15, 23, 42, 0.45)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div className="reveal" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "1rem" }}>How it works</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 800 }}>Four steps to automation</h2>
            </div>
            <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2rem", marginTop: "3.5rem" }}>
              {[
                { step: "01", title: "Register face", desc: "User faces the webcam. 200 samples are captured and averaged into a 512-D embedding." },
                { step: "02", title: "Live prediction", desc: "Frames stream over WebSocket. InsightFace extracts embeddings and compares them instantly." },
                { step: "03", title: "Log attendance", desc: "Matched identities are logged every 30 seconds. Unknown faces are flagged." },
                { step: "04", title: "View reports", desc: "Filter attendance by date or role. Duration is calculated automatically." }
              ].map((step, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", background: "#030712", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontWeight: 800, margin: "0 auto 1.5rem" }}>{step.step}</div>
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{step.title}</div>
                  <div style={{ fontSize: "13px", color: "#7a8a9a", lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section id="use-cases" style={{ padding: "7rem 3rem", maxWidth: "1100px", margin: "0 auto" }}>
          <div className="reveal">
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "1rem" }}>Use cases</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 800 }}>Built for real environments</h2>
          </div>
          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", marginTop: "3.5rem" }}>
            {[
              { e: "🏫", t: "Schools & colleges", d: "Automated student roll call. No proxy attendance. Period-wise reports." },
              { e: "🏢", t: "Offices & corporates", d: "Check-in without cards. Duration tracking feeds directly into HR dashboards." },
              { e: "🔐", t: "Secure access control", d: "Restrict entry to registered faces only. Unknown detections logged in real time." },
              { e: "🎪", t: "Event management", d: "Verify attendees at the door using guest lists. No queues, no ticket scanning." }
            ].map((use, i) => (
              <div key={i} style={{ background: "#0d1117", padding: "2.5rem", display: "flex", gap: "1.25rem" }}>
                <div style={{ fontSize: "28px" }}>{use.e}</div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>{use.t}</div>
                  <div style={{ fontSize: "13px", color: "#7a8a9a", lineHeight: 1.6 }}>{use.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "8rem 3rem", textAlign: "center", position: "relative" }}>
          <h2 className="reveal" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 800 }}>Ready to <em style={{ fontStyle: "normal", color: "var(--accent)" }}>eliminate</em> manual attendance?</h2>
          <div className="reveal" style={{ marginTop: "2.5rem", display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link href={userId ? "/dashboard" : "/login"} style={{ background: "var(--accent)", color: "#000", padding: "14px 32px", borderRadius: "8px", fontWeight: 500, textDecoration: "none" }}>{userId ? "Return to Dashboard" : "Launch the app"}</Link>
            <Link href={userId ? "/register" : "/login"} style={{ color: "#fff", padding: "14px 32px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none" }}>Register a face</Link>
          </div>
        </section>

        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "2rem 3rem", display: "flex", justifyContent: "space-between", color: "#4a5a6a", fontSize: "12px" }}>
          <div style={{ fontWeight: 800 }}>FaceAttend</div>
          <div>Built with InsightFace, FastAPI & Next.js</div>
        </footer>
      </div>
    </main>
  );
}
