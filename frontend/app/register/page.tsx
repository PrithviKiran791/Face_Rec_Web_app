// frontend/app/register/page.tsx
"use client";
import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { v4 as uuid } from "uuid";

const SAMPLE_TARGET = 60;
// We'll determine the WS URL dynamically inside the component to support HTTP/HTTPS transparently

export default function RegisterPage() {
  const { isLoaded, userId } = useAuth();
  const sessionIdRef = useRef(uuid());
  const webcamRef = useRef<Webcam>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameInFlightRef = useRef(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Student");
  const [samples, setSamples] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [message, setMessage] = useState("");

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    frameInFlightRef.current = false;
    setStreaming(false);
    setSocketStatus("idle");
  }, []);

  const resetSession = useCallback(() => {
    stopCapture();
    sessionIdRef.current = uuid();
    setSamples(0);
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
      // Fetch a short-lived WS token from the backend
      const { data } = await api.get("/api/auth/ws-token");
      const wsToken = (data as any).ws_token;
      
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
        setMessage("Failed to initialize registration stream.");
      }
    }, [cameraReady, samples, stopCapture]);

  const handleSubmit = async () => {
    if (!name) return setMessage("Please enter a name.");
    if (samples < SAMPLE_TARGET) return setMessage(`Capture ${SAMPLE_TARGET} samples first.`);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("role", role);
      form.append("session_id", sessionIdRef.current);
      const res = await api.post("/api/register/submit", form);
      setMessage((res.data as { message?: string }).message ?? "Registration saved.");
      setName("");
      setRole("Student");
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
            style={{ width: "100%", borderRadius: "12px", border: "1px solid #e4e7ec" }}
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
            <button onClick={resetSession} className="btn" style={{ flex: 1 }}>
              Reset Session
            </button>
          </div>

          <div>
            <div style={{ height: "8px", overflow: "hidden", borderRadius: "999px", background: "#eaecf0" }}>
              <div
                style={{
                  width: `${capturePercent}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #3b82f6, #465fff)",
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

          {message && <p className="small-note" style={{ fontSize: "13px", color: "#344054" }}>{message}</p>}
        </div>
      </section>
    </main>
  );
}