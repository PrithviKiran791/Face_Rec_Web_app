// frontend/app/register/page.tsx
"use client";
import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useAuth } from "@clerk/nextjs";
import { api, setApiToken } from "@/lib/api";
import { v4 as uuid } from "uuid";

const SAMPLE_TARGET = 60;

// ── Retry-aware WS token fetcher ─────────────────────────────────────────────
async function getWsToken(getToken: () => Promise<string | null>, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const clerkToken = await getToken();
      if (clerkToken) setApiToken(clerkToken);

      const { data } = await api.get("/api/auth/ws-token");
      return data.ws_token;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      if (i === retries - 1) {
        throw new Error(
          status === 401
            ? "Authentication failed. Your session may have expired — try signing out and back in."
            : `Failed to get WS token: ${err?.response?.data?.detail || err.message || "Network error"}`
        );
      }
    }
  }
  throw new Error("Failed to get WS token after retries");
}

/* ── Icons ────────────────────────────────────────────────────────────────── */
const CameraIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);

const UploadIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);

const TrashIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);

export default function RegisterPage() {
  const { isLoaded, userId, getToken } = useAuth();
  const sessionIdRef = useRef(uuid());
  const webcamRef = useRef<Webcam>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Student");
  const [samples, setSamples] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [message, setMessage] = useState("");

  // ── Profile Picture State ──────────────────────────────────────────────────
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    }
    frameInFlightRef.current = false;
    setStreaming(false);
    setSocketStatus("idle");
  }, []);

  const resetSession = useCallback(() => {
    stopCapture();
    sessionIdRef.current = uuid();
    setSamples(0);
    setProfilePic(null);
    setMessage("New capture session started.");
  }, [stopCapture]);

  // Connect a dedicated WebSocket for registration frame collection
  const startCapture = useCallback(async () => {
    if (!isLoaded || !userId) {
      setMessage("Preparing secure connection...");
      return;
    }
    if (!cameraReady) {
      setMessage("Camera is not ready yet. Please allow webcam permission.");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setMessage("");
    setSocketStatus("connecting");
    
    try {
      // Fetch a short-lived WS token with retry
      const wsToken = await getWsToken(getToken);
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = process.env.NEXT_PUBLIC_WS_URL 
        ? process.env.NEXT_PUBLIC_WS_URL.replace(/^ws(s)?:\/\//, "") 
        : window.location.host;
      
      const dynamicWsUrl = `${protocol}//${wsHost}`;
      const ws = new WebSocket(`${dynamicWsUrl}/ws/register?token=${wsToken}`);
      wsRef.current = ws;
      setStreaming(true);

      ws.onopen = () => {
        setSocketStatus("connected");
        intervalRef.current = setInterval(() => {
          if (!webcamRef.current || ws.readyState !== WebSocket.OPEN || frameInFlightRef.current) return;
          const frame = webcamRef.current.getScreenshot();
          if (!frame) return;
          frameInFlightRef.current = true;
          ws.send(JSON.stringify({ frame, session_id: sessionIdRef.current }));
        }, 180);
      };

      ws.onmessage = (e) => {
        frameInFlightRef.current = false;
        try {
          const payload = JSON.parse(e.data) as Record<string, unknown>;
          const nextCount =
            (typeof payload.sample_count === "number" && payload.sample_count) ||
            (typeof payload.samples === "number" && payload.samples) ||
            (typeof payload.count === "number" && payload.count) ||
            samples;

          setSamples(nextCount);

          if (typeof payload.message === "string" && payload.message) {
            setMessage(payload.message);
          }

          if (typeof payload.error === "string" && payload.error) {
            setMessage(`Capture warning: ${payload.error}`);
          }

          if (nextCount >= SAMPLE_TARGET) {
            stopCapture();
            setMessage("Sample target reached. Submit registration to save this identity.");
          }
        } catch {
          setMessage("Received invalid data from registration stream.");
        }
      };

      ws.onerror = () => {
        setSocketStatus("error");
        setMessage("Unable to connect to registration socket. Check backend /ws/register.");
      };

      ws.onclose = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        frameInFlightRef.current = false;
        setStreaming(false);
        setSocketStatus("idle");
      };
    } catch (err: any) {
      console.error("Registration stream error:", err);
      setSocketStatus("error");
      setMessage(err.message || "Failed to initialize registration stream.");
    }
  }, [cameraReady, isLoaded, userId, getToken, samples, stopCapture]);

  // ── Profile Picture Handlers ───────────────────────────────────────────────

  const captureProfilePic = () => {
    if (!webcamRef.current) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (screenshot) {
      setProfilePic(screenshot);
      setMessage("Profile photo captured!");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file (JPEG, PNG, etc.).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image too large. Please use an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Resize the image to a reasonable profile pic size
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256;
        let w = img.width, h = img.height;
        if (w > h) { h = (h / w) * maxSize; w = maxSize; }
        else { w = (w / h) * maxSize; h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setProfilePic(canvas.toDataURL("image/jpeg", 0.85));
          setMessage("Profile photo uploaded!");
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be re-selected
    e.target.value = "";
  };

  const removeProfilePic = () => {
    setProfilePic(null);
    setMessage("");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name) return setMessage("Please enter a name.");
    if (samples < SAMPLE_TARGET) return setMessage(`Capture ${SAMPLE_TARGET} samples first.`);
    setSubmitting(true);
    try {
      // Ensure Clerk token is fresh before submitting
      const clerkToken = await getToken();
      if (clerkToken) setApiToken(clerkToken);

      const form = new FormData();
      form.append("name", name);
      form.append("role", role);
      form.append("session_id", sessionIdRef.current);
      if (profilePic) {
        form.append("profile_pic", profilePic);
      }
      const res = await api.post("/api/register/submit", form);
      setMessage((res.data as { message?: string }).message ?? "Registration saved.");
      setName("");
      setRole("Student");
      setProfilePic(null);
      sessionIdRef.current = uuid();
      setSamples(0);
    } catch {
      setMessage("Registration submit failed. Please verify backend logs and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const capturePercent = Math.min((samples / SAMPLE_TARGET) * 100, 100);

  return (
    <main className="space-y-4">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Register New Identity</h2>
            <p className="panel-subtitle">Capture clean face samples and submit to the recognition database.</p>
          </div>
        </div>

        <div className="panel-body" style={{ display: "grid", gap: "20px" }}>

          {/* Name, Role + Profile Picture row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>

            {/* Name + Role fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Role / Identity</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option>Student</option>
                  <option>Teacher</option>
                </select>
              </div>
            </div>

            {/* Profile Picture */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Profile Photo</label>
              <div className="profile-pic-container">
                {profilePic ? (
                  <>
                    <img
                      src={profilePic}
                      alt="Profile"
                      className="profile-pic-preview"
                    />
                    <button
                      className="profile-pic-remove"
                      onClick={removeProfilePic}
                      title="Remove photo"
                    >
                      {TrashIcon}
                    </button>
                  </>
                ) : (
                  <div className="profile-pic-placeholder">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="profile-pic-btn"
                  onClick={captureProfilePic}
                  disabled={!cameraReady}
                  title="Capture from webcam"
                >
                  {CameraIcon}
                </button>
                <button
                  type="button"
                  className="profile-pic-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload from file"
                >
                  {UploadIcon}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>
            </div>
          </div>

          <Webcam
            ref={webcamRef}
            onUserMedia={() => setCameraReady(true)}
            onUserMediaError={() => {
              setCameraReady(false);
              setMessage("Webcam access denied. Please allow camera permission.");
            }}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.85}
            videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
            style={{ width: "100%", borderRadius: "12px", border: "1px solid var(--border)" }}
          />

          <p className="small-note">
            Camera: {cameraReady ? "Ready" : "Waiting"} | Socket: {socketStatus}
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={startCapture} disabled={streaming || !cameraReady} className="btn btn-primary" style={{ flex: 1 }}>
              Start Capture
            </button>
            <button onClick={stopCapture} disabled={!streaming} className="btn btn-danger" style={{ flex: 1 }}>
              Stop
            </button>
            <button onClick={resetSession} className="btn" style={{ flex: 1, border: "1px solid var(--border)", color: "var(--text-main)" }}>
              Reset Session
            </button>
          </div>

          <div>
            <div style={{ height: "8px", overflow: "hidden", borderRadius: "999px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div
                style={{
                  width: `${capturePercent}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, var(--accent), #6366f1)",
                  transition: "width .2s ease"
                }}
              />
            </div>
            <p className="small-note" style={{ marginTop: "6px" }}>
              {samples} / {SAMPLE_TARGET} samples captured
            </p>
          </div>

          <button onClick={handleSubmit} disabled={streaming || submitting} className="btn btn-primary">
            {submitting ? "Submitting..." : "Submit Registration"}
          </button>

          {message && (
            <p className="small-note" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}