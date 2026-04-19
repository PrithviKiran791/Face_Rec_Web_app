"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Welcome Card */}
      <div className="panel">
        <div className="panel-body" style={{ padding: "36px 40px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
            Welcome back, {user?.name || "Admin"}! 👋
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "16px", lineHeight: 1.6 }}>
            The Face Attendance System is running smoothly. Here's a quick overview of today's activity.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
        <StatCard title="Total Registered" value="128" accent="#0ea5e9" />
        <StatCard title="Present Today" value="42" accent="#22c55e" />
        <StatCard title="System Uptime" value="99.9%" accent="#8b5cf6" />
      </div>

      {/* Quick Actions */}
      <div className="panel">
        <div className="panel-body" style={{ padding: "32px 40px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>Quick Actions</h3>
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/live" className="btn btn-primary" style={{ textDecoration: "none" }}>
              📹 Launch Live Monitor
            </Link>
            <Link href="/register" className="btn" style={{ 
              textDecoration: "none", 
              border: "1px solid var(--border)", 
              color: "var(--text-main)" 
            }}>
              🧑 Register New Face
            </Link>
            <Link href="/report" className="btn" style={{ 
              textDecoration: "none", 
              border: "1px solid var(--border)", 
              color: "var(--text-main)" 
            }}>
              📋 View Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="panel" style={{ minHeight: "160px" }}>
      <div className="panel-body" style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>{title}</p>
        <h4 style={{ fontSize: "42px", fontWeight: 800, color: accent, marginTop: "12px" }}>{value}</h4>
      </div>
    </div>
  );
}
