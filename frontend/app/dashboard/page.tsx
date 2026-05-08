"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { getReport, getLogs, getIdentities, api, getTodayAbsentees } from "@/lib/api";
import Link from "next/link";
import { parseRows, statusBadgeClass } from "@/lib/parseRows";
import type { ReportRow } from "@/lib/parseRows";

/* ── SVG Icons ─────────────────────────────────────────────────────────────── */
const Icons = {
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  xCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  camera: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

/* ── Micro Chart ───────────────────────────────────────────────────────────── */
function MicroChart({ color, seed }: { color: string; seed: number }) {
  const bars = useMemo(() => Array.from({ length: 7 }, (_, i) => 30 + ((seed * (i + 1) * 17) % 70)), [seed]);
  return (
    <div className="micro-chart">
      {bars.map((h, i) => (
        <div key={i} className="micro-bar" style={{ height: `${h}%`, background: color, opacity: 0.6 + (i * 0.05) }} />
      ))}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useUser();
  const { isLoaded, userId } = useAuth();
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(now.toLocaleDateString("en-US", { weekday: "long", month: "2-digit", day: "2-digit", year: "numeric" }));
      setClock(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { data: reportData } = useQuery<ReportRow[]>({
    queryKey: ["dashboard-report", userId],
    enabled: !!isLoaded && !!userId,
    staleTime: 0,
    refetchInterval: 10000,
    queryFn: async () => {
      const res = await getReport();
      const rows = parseRows(res.data);
      if (rows.length > 0) return rows;
      const logsRes = await getLogs();
      return parseRows(logsRes.data);
    },
  });

  const { data: identitiesData } = useQuery<string[]>({
    queryKey: ["identities", userId],
    enabled: !!isLoaded && !!userId,
    staleTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await getIdentities();
      return (res.data as any).identities as string[];
    },
  });

  const { data: healthData } = useQuery<{ api: string; redis: string }>({
    queryKey: ["health"],
    staleTime: 0,
    refetchInterval: 30000,
    queryFn: async () => { const res = await api.get("/api/health"); return res.data; },
  });

  const { data: absenteesData } = useQuery<{
    date: string;
    sessions: {
      session_id: string;
      session_name: string;
      group_name: string;
      start_time: string;
      end_time: string;
      status: string;
      total_members: number;
      present_count: number;
      absent_count: number;
      absent_members: { identity: string; name: string; session_name: string; group_name: string; time_range: string }[];
    }[];
    total_absent: number;
  }>({
    queryKey: ["today-absentees", userId],
    enabled: !!isLoaded && !!userId,
    staleTime: 0,
    refetchInterval: 15000,
    queryFn: async () => (await getTodayAbsentees()).data,
  });

  const todayISO = new Date().toISOString().split("T")[0];
  const allRows = reportData ?? [];
  const todayRecords = allRows.filter((r) => r.Date === todayISO);
  const presentToday = todayRecords.filter((r) => r.Status === "Present" || r.Status === "Half Day").length;
  const absentToday = todayRecords.filter((r) => r.Status === "Absent" || r.Status.includes("less than")).length;
  const lateToday = todayRecords.filter((r) => r.Status === "Half Day").length;
  const totalRegistered = identitiesData?.length ?? 0;
  const progressPct = totalRegistered > 0 ? Math.round((presentToday / totalRegistered) * 100) : 0;
  const recentActivity = allRows.slice(-10).reverse();
  const redisOk = healthData?.redis === "connected";
  const activeSessions = absenteesData?.sessions?.filter((s) => s.status === "active") ?? [];
  const totalAbsentNow = activeSessions.reduce((s, sess) => s + sess.absent_count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Section Header ──────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <div className="section-title">Attendance & Enrollment Overview</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>{dateStr}  •  {clock}</div>
        </div>
        <div className={`live-pill ${redisOk ? "online" : "offline"}`}>
          <span className="pulse-dot" style={{ background: redisOk ? "var(--success)" : "var(--danger)" }} />
          {redisOk ? "System Online" : "Redis Offline"}
        </div>
      </div>

      {/* ── Main Grid: Left content + Right feed ────────────────────────────── */}
      <div className="dash-grid-main">
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Welcome */}
          <div className="panel">
            <div className="panel-body" style={{ padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>Welcome back, {user?.fullName || "Admin"} 👋</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Here's your attendance overview for today.</p>
              </div>
              <div className="quick-actions">
                <Link href="/live" className="quick-action-btn">{Icons.camera} Live Monitor</Link>
                <Link href="/register" className="quick-action-btn">👤 Register Face</Link>
                <Link href="/report" className="quick-action-btn">📋 Reports</Link>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
            <StatCard icon={Icons.users} label="Total Registered" value={totalRegistered} color="var(--accent)" bgColor="var(--accent-glow)" seed={42} />
            <StatCard icon={Icons.check} label="Present Today" value={presentToday} color="var(--success)" bgColor="rgba(34,197,94,0.1)" seed={77} />
            <StatCard icon={Icons.xCircle} label="Absent Today" value={absentToday} color="var(--danger)" bgColor="rgba(239,68,68,0.1)" seed={13} />
            <StatCard icon={Icons.clock} label="Active Sessions" value={activeSessions.length} color="var(--warning)" bgColor="rgba(245,158,11,0.1)" seed={31} />
          </div>

          {/* Attendance Progress */}
          <div className="panel">
            <div className="panel-body" style={{ padding: "24px 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>Today's Attendance Rate</span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{presentToday} / {totalRegistered} ({progressPct}%)</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%`, background: progressPct >= 75 ? "var(--success)" : progressPct >= 40 ? "var(--warning)" : "var(--accent)" }} />
              </div>
            </div>
          </div>

          {/* Who's Missing Right Now */}
          <div className="panel">
            <div className="panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🚨</span>
                <div>
                  <div className="panel-title" style={{ fontSize: "16px" }}>Who's Missing Right Now</div>
                  <div className="panel-subtitle">Absentees from currently active sessions</div>
                </div>
              </div>
              {totalAbsentNow > 0 && <span className="badge danger" style={{ fontSize: "11px" }}>{totalAbsentNow} ABSENT</span>}
            </div>
            <div className="panel-body" style={{ padding: activeSessions.length === 0 ? "24px" : "0" }}>
              {(absenteesData?.sessions?.length ?? 0) === 0 ? (
                <div style={{ textAlign: "center", padding: "24px" }}>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "12px" }}>No sessions are configured yet.</p>
                  <Link href="/sessions" className="btn btn-primary" style={{ fontSize: "13px", padding: "10px 20px" }}>
                    📅 Set Up Sessions
                  </Link>
                </div>
              ) : activeSessions.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  <p>No sessions are active right now.</p>
                  <p style={{ marginTop: "4px", fontSize: "12px" }}>
                    {absenteesData?.sessions?.filter(s => s.status === "upcoming").length ?? 0} upcoming today
                  </p>
                </div>
              ) : (
                activeSessions.map((sess) => (
                  <div key={sess.session_id} style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-main)" }}>{sess.session_name}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "10px" }}>
                          {sess.group_name} · {sess.start_time} – {sess.end_time}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>✓ {sess.present_count}</span>
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>✗ {sess.absent_count}</span>
                      </div>
                    </div>
                    {sess.absent_count === 0 ? (
                      <p style={{ fontSize: "12px", color: "var(--success)", fontStyle: "italic" }}>Everyone is present! 🎉</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {sess.absent_members.map((m) => (
                          <span key={m.identity} className="absent-chip">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Late Today & On Leave Lists */}
          <div className="dash-grid-2">
            <UserListPanel title="Late Today" icon={Icons.clock} items={todayRecords.filter(r => r.Status === "Half Day")} emptyMsg="No late arrivals today." />
            <UserListPanel title="Absent / On Leave" icon={Icons.xCircle} items={todayRecords.filter(r => r.Status === "Absent" || r.Status.includes("less than"))} emptyMsg="Everyone is present!" />
          </div>

        </div>

        {/* RIGHT COLUMN — Attendance Feed */}
        <div className="panel" style={{ position: "sticky", top: "100px" }}>
          <div className="panel-header">
            <div>
              <div className="panel-title" style={{ fontSize: "16px" }}>Attendance Feed</div>
              <div className="panel-subtitle">Real-time check-ins</div>
            </div>
            <span className="badge success" style={{ fontSize: "10px" }}>LIVE</span>
          </div>
          <div className="feed-container" style={{ padding: 0 }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "32px", marginBottom: "8px" }}>📡</p>
                <p style={{ fontSize: "13px" }}>No attendance events yet.</p>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>Start the Live Monitor to begin tracking.</p>
              </div>
            ) : (
              recentActivity.map((row, i) => (
                <div key={`${row.Date}-${row.Name}-${i}`} className="feed-item">
                  <div className={`feed-avatar verified`} style={{
                    background: row.Status === "Present" ? "rgba(34,197,94,0.12)" : row.Status === "Half Day" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                    color: row.Status === "Present" ? "var(--success)" : row.Status === "Half Day" ? "var(--warning)" : "var(--danger)",
                  }}>
                    {row.Name.substring(0, 2).toUpperCase()}
                    <div className="feed-avatar-badge" />
                  </div>
                  <div className="feed-content">
                    <div className="feed-name">{row.Name}</div>
                    <div className="feed-detail">{row.Role} · <span className={`badge ${statusBadgeClass(row.Status)}`} style={{ fontSize: "9px", padding: "2px 6px" }}>{row.Status}</span></div>
                    <div className="feed-match">{Icons.shield} Verified: Face Match</div>
                  </div>
                  <div className="feed-time">{row.In_time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, bgColor, seed }: {
  icon: React.ReactNode; label: string; value: number; color: string; bgColor: string; seed: number;
}) {
  return (
    <div className="panel">
      <div className="stat-widget">
        <div className="stat-widget-header">
          <div>
            <div className="stat-widget-label">{label}</div>
            <div className="stat-widget-value" style={{ color, marginTop: "8px" }}>{value}</div>
          </div>
          <div className="stat-widget-icon" style={{ background: bgColor, color }}>{icon}</div>
        </div>
        <MicroChart color={color} seed={seed} />
      </div>
    </div>
  );
}

/* ── User List Panel ───────────────────────────────────────────────────────── */
function UserListPanel({ title, icon, items, emptyMsg }: {
  title: string; icon: React.ReactNode; items: ReportRow[]; emptyMsg: string;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--text-muted)" }}>{icon}</span>
          <span className="panel-title" style={{ fontSize: "15px" }}>{title}</span>
        </div>
        <span className="badge warning" style={{ fontSize: "10px" }}>{items.length}</span>
      </div>
      <div style={{ padding: 0 }}>
        {items.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>{emptyMsg}</div>
        ) : (
          items.slice(0, 5).map((row, i) => (
            <div key={`${row.Name}-${i}`} className="feed-item">
              <div className="feed-avatar" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)", width: "36px", height: "36px", fontSize: "12px" }}>
                {row.Name.substring(0, 2).toUpperCase()}
              </div>
              <div className="feed-content">
                <div className="feed-name">{row.Name}</div>
                <div className="feed-detail">{row.Role} · In: {row.In_time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
