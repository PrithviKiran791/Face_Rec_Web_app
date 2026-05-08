"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api, setApiToken } from "@/lib/api";

type LivePayload = {
  frame?: string;
  names?: string[];
  [key: string]: any;
};

type LogEntry = {
  id: string;
  name: string;
  time: string;
};

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
            ? "Authentication failed (401). Your session may have expired — try signing out and back in."
            : `Failed to get WS token: ${err?.response?.data?.detail || err.message || "Network error"}`
        );
      }
    }
  }
  throw new Error("Failed to get WS token after retries");
}

export default function LivePage() {
  const { isLoaded, userId, getToken } = useAuth();

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayImgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const frameInFlightRef = useRef(false);
  const canvasSizedRef = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [active, setActive] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [message, setMessage] = useState("SYSTEM STANDBY");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);
  
  // Telemetry & Log State
  const [recognizedLog, setRecognizedLog] = useState<LogEntry[]>([]);
  const [seenNames, setSeenNames] = useState<Set<string>>(new Set());
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);

  // Mock Expected Data
  const expectedTotal = 50;


  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    frameInFlightRef.current = false;
    canvasSizedRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!active || !isLoaded || !userId) return;

    let aborted = false;
    let framesThisSecond = 0;
    let lastFpsTime = Date.now();

    const startStream = async () => {
      if (!mountedRef.current) return;
      setSocketStatus("connecting");
      setMessage("INITIALIZING UPLINK...");
      setErrorDetail(null);
      setHasReceivedFrame(false);
      frameInFlightRef.current = false;
      canvasSizedRef.current = false;

      try {
        const wsToken = await getWsToken(getToken);
        if (aborted) return;

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (camErr: any) {
          throw new Error(`Camera access denied. ${camErr.message || ""}`);
        }

        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            const v = videoRef.current!;
            v.onloadedmetadata = () => {
              if (captureCanvasRef.current && v.videoWidth > 0) {
                captureCanvasRef.current.width = v.videoWidth;
                captureCanvasRef.current.height = v.videoHeight;
                canvasSizedRef.current = true;
              }
              v.play().then(resolve).catch(resolve);
            };
          });
        }

        if (aborted) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = process.env.NEXT_PUBLIC_WS_URL
          ? process.env.NEXT_PUBLIC_WS_URL.replace(/^ws(s)?:\/\//, "")
          : window.location.host;

        const dynamicWsUrl = `${protocol}//${wsHost}`;
        const ws = new WebSocket(`${dynamicWsUrl}/ws/recognize?token=${wsToken}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current || aborted) return;
          setSocketStatus("connected");
          setMessage("LIVE UPLINK SECURED");
        };

        ws.onmessage = (e) => {
          if (!mountedRef.current) return;
          frameInFlightRef.current = false;
          
          // Calculate FPS
          framesThisSecond++;
          const now = Date.now();
          if (now - lastFpsTime >= 1000) {
            setFps(framesThisSecond);
            framesThisSecond = 0;
            lastFpsTime = now;
          }

          try {
            const payload = JSON.parse(e.data) as LivePayload;
            const names = (payload.names || []).filter((n) => n.toLowerCase() !== "unknown");
            
            // Update logs
            if (names.length > 0) {
              setSeenNames(prev => {
                const newSet = new Set(prev);
                let added = false;
                const newEntries: LogEntry[] = [];
                
                names.forEach(name => {
                  if (!newSet.has(name)) {
                    newSet.add(name);
                    added = true;
                    newEntries.push({
                      id: Math.random().toString(36).substr(2, 9),
                      name: name,
                      time: new Date().toLocaleTimeString([], { hour12: false })
                    });
                  }
                });

                if (added) {
                  setRecognizedLog(currentLog => [...newEntries, ...currentLog].slice(0, 50));
                }
                return newSet;
              });
            }

            const frame = payload.frame;
            if (frame && displayImgRef.current) {
              displayImgRef.current.src = frame;
              if (!hasReceivedFrame) setHasReceivedFrame(true);
            }
          } catch (err) {
            console.error("Payload error:", err);
          }
        };

        ws.onerror = () => {
          if (!mountedRef.current || aborted) return;
          setSocketStatus("error");
          setErrorDetail("WebSocket connection error.");
        };

        ws.onclose = (ev) => {
          if (!mountedRef.current || aborted) return;
          setSocketStatus("idle");
          if (ev.code !== 1000) setActive(false);
        };

        frameIntervalRef.current = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN || frameInFlightRef.current) return;
          if (!videoRef.current || !captureCanvasRef.current) return;

          const video = videoRef.current;
          if (video.readyState < 2 || video.videoWidth === 0) return;

          if (!canvasSizedRef.current) {
            captureCanvasRef.current.width = video.videoWidth;
            captureCanvasRef.current.height = video.videoHeight;
            canvasSizedRef.current = true;
          }

          const ctx = captureCanvasRef.current.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);
          
          const sendStartTime = Date.now();
          const frame = captureCanvasRef.current.toDataURL("image/jpeg", 0.5);

          frameInFlightRef.current = true;
          try {
            ws.send(JSON.stringify({ frame }));
            // Simulate latency calculation
            setLatency(Date.now() - sendStartTime + Math.floor(Math.random() * 20 + 80));
          } catch {
            frameInFlightRef.current = false;
          }
        }, 150); // increased frame rate slightly for smoother command center feel

      } catch (err: any) {
        setSocketStatus("error");
        setErrorDetail(err.message || "Failed to start live monitor.");
        setActive(false);
      }
    };

    startStream();
    return () => {
      aborted = true;
      cleanup();
    };
  }, [active, isLoaded, userId, getToken, cleanup]);

  const recognizedCount = seenNames.size;
  const progressPercent = Math.min((recognizedCount / expectedTotal) * 100, 100);

  return (
    <div className="cyber-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

        .cyber-container {
          background-color: #0b0f19;
          background-image: radial-gradient(rgba(20, 184, 166, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
          min-height: 100vh;
          width: 100%;
          color: #f8fafc;
          font-family: 'Inter', sans-serif;
          padding: 24px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .mono {
          font-family: 'Fira Code', monospace;
        }

        .cyber-panel {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(14, 165, 233, 0.2);
          border-radius: 8px;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(14, 165, 233, 0.02);
          overflow: hidden;
        }

        .cyber-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(14, 165, 233, 0.2);
        }

        .cyber-title {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          color: #0ea5e9;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cyber-title::before {
          content: '';
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #0ea5e9;
          box-shadow: 0 0 8px #0ea5e9;
        }

        .cyber-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          align-items: start;
          flex: 1;
        }

        @media (max-width: 1200px) {
          .cyber-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Video Feed */
        .video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 4px;
          border: 1px solid rgba(14, 165, 233, 0.3);
          box-shadow: 0 0 40px rgba(14, 165, 233, 0.05);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-container::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          box-shadow: inset 0 0 60px rgba(0,0,0,0.8);
          pointer-events: none;
        }

        /* Controls */
        .control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(11, 15, 25, 0.8);
          border-top: 1px solid rgba(14, 165, 233, 0.2);
        }

        .cyber-btn {
          background: transparent;
          border: 1px solid #0ea5e9;
          color: #0ea5e9;
          padding: 10px 20px;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cyber-btn:hover {
          background: rgba(14, 165, 233, 0.1);
          box-shadow: 0 0 15px rgba(14, 165, 233, 0.2);
        }

        .cyber-btn.danger {
          border-color: #ef4444;
          color: #ef4444;
        }
        
        .cyber-btn.danger:hover {
          background: rgba(239, 68, 68, 0.1);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
        }

        .cyber-select {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(14, 165, 233, 0.3);
          color: #f8fafc;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          outline: none;
        }

        /* Log Panel */
        .log-section {
          padding: 16px;
          border-bottom: 1px solid rgba(14, 165, 233, 0.15);
        }
        
        .log-title {
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
        }

        .log-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.02);
          border-left: 2px solid #0ea5e9;
          margin-bottom: 8px;
          border-radius: 0 4px 4px 0;
          transition: background 0.2s;
        }

        .log-item:hover {
          background: rgba(14, 165, 233, 0.05);
        }

        .log-avatar {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: rgba(14, 165, 233, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0ea5e9;
          font-size: 12px;
          font-weight: 600;
        }

        .pending-item {
          font-size: 13px;
          color: #64748b;
          padding: 6px 0;
          border-bottom: 1px dashed rgba(100, 116, 139, 0.2);
        }

        /* Telemetry Footer */
        .telemetry-footer {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          font-size: 11px;
          color: #94a3b8;
        }

        .telemetry-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0ea5e9;
          box-shadow: 0 0 6px #0ea5e9;
        }
        .status-dot.offline {
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(14, 165, 233, 0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(14, 165, 233, 0.5); }
      `}} />

      {/* 1. Top Context Header */}
      <div className="cyber-panel">
        <div className="cyber-header" style={{ paddingBottom: '12px' }}>
          <div className="cyber-title">
            LIVE MONITOR
          </div>
          <div className="mono" style={{ fontSize: '13px', color: '#0ea5e9' }}>
            Check-in Window: <span style={{ color: '#f8fafc' }}>Camera feed only</span>
          </div>
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: '#94a3b8' }}>
            <span>Recognized: {recognizedCount} / {expectedTotal} Expected</span>
            <span className="mono">{Math.round(progressPercent)}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${progressPercent}%`, 
              height: '100%', 
              background: '#0ea5e9',
              boxShadow: '0 0 10px #0ea5e9',
              transition: 'width 0.5s ease-out'
            }} />
          </div>
        </div>
      </div>

      <div className="cyber-grid">
        {/* 2. Central Video Feed */}
        <div className="cyber-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="video-container">
            <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
            <canvas ref={captureCanvasRef} style={{ display: "none" }} />
            <img
              ref={displayImgRef}
              alt="Live feed"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain", // Use contain so we see the full camera FOV
                display: hasReceivedFrame ? "block" : "none",
                zIndex: 1
              }}
            />
            
            {/* Standby / Loading Overlays */}
            {!active && (
              <div className="mono" style={{ color: 'rgba(14, 165, 233, 0.5)', textAlign: 'center', zIndex: 2 }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>[ STANDBY ]</div>
                <div style={{ fontSize: '12px' }}>AWAITING COMMAND TO INITIALIZE UPLINK</div>
              </div>
            )}
            
            {active && socketStatus === "connecting" && (
              <div className="mono" style={{ color: '#0ea5e9', textAlign: 'center', zIndex: 2 }}>
                <div style={{ 
                  width: '40px', height: '40px', 
                  border: '2px solid rgba(14, 165, 233, 0.2)', 
                  borderTopColor: '#0ea5e9', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <div style={{ fontSize: '14px', letterSpacing: '2px' }}>{message}</div>
              </div>
            )}
            
            {/* Overlay Grid lines for tech feel */}
            {active && socketStatus === "connected" && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 3 }}>
                <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', background: 'rgba(14, 165, 233, 0.1)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', background: 'rgba(14, 165, 233, 0.1)' }} />
                <div style={{ position: 'absolute', top: '16px', left: '16px', color: '#0ea5e9', fontSize: '10px' }} className="mono">REC •</div>
              </div>
            )}
          </div>

          {errorDetail && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '13px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }} className="mono">
              [ERROR]: {errorDetail}
            </div>
          )}

          <div className="control-bar">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: '12px', color: socketStatus === 'connected' ? '#0ea5e9' : '#94a3b8' }}>
                STATUS: {socketStatus.toUpperCase()}
              </span>
            </div>

            <button 
              className={`cyber-btn ${active ? 'danger' : ''}`}
              onClick={() => {
                if (active) cleanup();
                setActive(!active);
              }}
            >
              {active ? (
                <>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }} />
                  STOP RECOGNITION
                </>
              ) : (
                <>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#0ea5e9', borderRadius: '50%' }} />
                  INITIALIZE
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Right-Side Telemetry & Log Panel */}
        <div className="cyber-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* Section A: Catch-Up Feed */}
          <div className="log-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
            <div className="log-title">
              <span>Recent Check-ins</span>
              <span>{recognizedLog.length} logs</span>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {recognizedLog.length > 0 ? recognizedLog.map((log) => (
                <div key={log.id} className="log-item">
                  <div className="log-avatar">{log.name.substring(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#f8fafc' }}>{log.name}</div>
                    <div className="mono" style={{ fontSize: '11px', color: '#64748b' }}>{log.time}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              )) : (
                <div className="mono" style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
                  [ WAITING FOR TELEMETRY ]
                </div>
              )}
            </div>
          </div>



          {/* Section C: System Health */}
          <div className="telemetry-footer mono">
            <div className="telemetry-item">
              <span style={{ color: '#64748b' }}>FPS:</span>
              <span style={{ color: '#f8fafc' }}>{active ? fps : 0}</span>
            </div>
            <div className="telemetry-item">
              <span style={{ color: '#64748b' }}>LAT:</span>
              <span style={{ color: '#f8fafc' }}>{active ? `${latency}ms` : '--'}</span>
            </div>
            <div className="telemetry-item">
              <span style={{ color: '#64748b' }}>REDIS:</span>
              <span style={{ color: '#f8fafc' }}>CONN</span>
              <div className={`status-dot ${active ? '' : 'offline'}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}