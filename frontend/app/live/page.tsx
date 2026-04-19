"use client";

import { useRef, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8000";

type LivePayload = {
  frame?: string;
  names?: string[];
  [key: string]: any;
};

export default function LivePage() {
  const { isLoaded, userId } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognizedNamesRef = useRef<string[]>([]);
  
  const [active, setActive] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [recognizedNames, setRecognizedNames] = useState<string[]>([]);
  const [message, setMessage] = useState("Ready to start.");

  useEffect(() => {
    if (!active || !isLoaded || !userId) return;

    let ws: WebSocket | null = null;
    let frameInterval: any = null;

    const startStream = async () => {
      setSocketStatus("connecting");
      setMessage("Initializing...");

      try {
        // 1. Get WebSocket Token
        const { data } = await api.get("/api/auth/ws-token");
        const wsToken = data.ws_token;

        // 2. Setup WebSocket
        ws = new WebSocket(`${WS_BASE_URL}/ws/recognize?token=${wsToken}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setSocketStatus("connected");
          setMessage("Live connection established.");
        };

        ws.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data) as LivePayload;
            const names = (payload.names || []).filter(n => n.toLowerCase() !== "unknown");
            recognizedNamesRef.current = names;
            setRecognizedNames(names);

            const frame = payload.frame;
            if (frame && canvasRef.current) {
              const img = new Image();
              img.onload = () => {
                const ctx = canvasRef.current?.getContext("2d");
                if (ctx && canvasRef.current) {
                  ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }
              };
              img.src = frame;
            }
          } catch (err) {
            console.error("Payload error:", err);
          }
        };

        ws.onerror = () => setSocketStatus("error");
        ws.onclose = () => setSocketStatus("idle");

        // 3. Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // IMPORTANT: Wait for the video to actually have dimensions
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              console.log("Video metadata loaded:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
            }
          };
        }

        // 4. Send Frames
        frameInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN && videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            
            // Only draw if the video is actually playing and has size
            if (!ctx || video.readyState < 2 || video.videoWidth === 0) return;

            if (canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            
            ctx.drawImage(video, 0, 0);
            const frame = canvas.toDataURL("image/jpeg", 0.5);
            ws.send(JSON.stringify({ frame }));
          }
        }, 120); // Faster refresh for smoother feel

      } catch (err: any) {
        console.error("Stream error:", err);
        setSocketStatus("error");
        setMessage(err.message || "Failed to start stream.");
        setActive(false);
      }
    };

    startStream();

    return () => {
      if (frameInterval) clearInterval(frameInterval);
      if (ws) ws.close();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [active, isLoaded, userId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Live Recognition Monitor</h2>
            <p className="panel-subtitle">Real-time attendance tracking via AI.</p>
          </div>
          <span className={`badge ${active ? "success" : "warning"}`}>
            {active ? socketStatus.toUpperCase() : "IDLE"}
          </span>
        </div>

        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ 
            position: "relative", 
            width: "100%",
            borderRadius: "20px",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "#000",
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <video ref={videoRef} autoPlay muted style={{ display: "none" }} />
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            
            {!active && (
              <div style={{ position: "absolute", textAlign: "center", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "48px", marginBottom: "10px" }}>📹</p>
                <p>Click Start to begin monitoring</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => setActive(!active)} 
            className={`btn ${active ? "btn-danger" : "btn-primary"}`}
            style={{ width: "100%", height: "54px", fontSize: "16px" }}
          >
            {active ? "Stop Recognition" : "Start Recognition"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="panel-title">Recent Detections</p>
          <p className="small-note">{message}</p>
        </div>
        <div className="panel-body">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {recognizedNames.length > 0 ? (
              recognizedNames.map((name) => (
                <div key={name} style={{ 
                  padding: "12px 20px", 
                  background: "var(--surface)", 
                  borderRadius: "12px", 
                  border: "1px solid var(--accent)",
                  color: "var(--text-main)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <span style={{ color: "var(--success)" }}>●</span> {name}
                </div>
              ))
            ) : (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Waiting for faces...</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}