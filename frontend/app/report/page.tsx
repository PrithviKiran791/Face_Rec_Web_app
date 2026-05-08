"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getLogs, getReport, clearLogs, getTodayAbsentees } from "@/lib/api";
import { parseRows, statusBadgeClass } from "@/lib/parseRows";
import type { ReportRow } from "@/lib/parseRows";

type AbsenteeSession = {
  session_id: string;
  session_name: string;
  group_name: string;
  start_time: string;
  end_time: string;
  status: string;
  total_members: number;
  present_count: number;
  absent_count: number;
  absent_members: Array<{ identity: string; name: string; session_id: string; session_name: string; group_name: string; time_range: string }>;
};

export default function ReportPage() {
  const [dateFilter, setDateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const { isLoaded, userId } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", userId],
    enabled: !!isLoaded && !!userId,
    staleTime: 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const reportResp = await getReport();
      const reportRows = parseRows(reportResp.data);
      if (reportRows.length > 0) return reportRows;

      const logsResp = await getLogs();
      return parseRows(logsResp.data);
    }
  });

  const { data: absenteesData } = useQuery({
    queryKey: ["absentees-today", userId],
    enabled: !!isLoaded && !!userId,
    staleTime: 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const resp = await getTodayAbsentees();
      return resp.data as { sessions: AbsenteeSession[]; total_absent: number };
    }
  });

  const filtered = (data ?? []).filter((row) => {
    if (dateFilter && row.Date !== dateFilter) return false;
    if (nameFilter && !row.Name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (statusFilter !== "All" && row.Status !== statusFilter) return false;
    return true;
  });

  const totalRows = filtered.length;
  const presentCount = filtered.filter((r) => r.Status === "Present").length;
  const absentCount = filtered.filter((r) => r.Status === "Absent").length;

  // CSV Export
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ["Date", "Name", "Role", "In Time", "Out Time", "Hours", "Status"];
    const csvContent = [
      headers.join(","),
      ...filtered.map((row) =>
        [
          row.Date,
          row.Name,
          row.Role,
          row.In_time,
          row.Out_time,
          row.Duration_hours?.toFixed(1) ?? "-",
          row.Status
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance-report-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get all records for a specific person
  const personRecords = selectedPerson ? filtered.filter((r) => r.Name === selectedPerson) : [];

  return (
    <main className="space-y-4">
      {/* Absentee Summary Panel */}
      {absenteesData && absenteesData.sessions.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Today's Absentees</h2>
              <p className="panel-subtitle">Overview of who is missing from today's scheduled sessions.</p>
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {absenteesData.sessions.map((session) => (
              <div
                key={session.session_id}
                style={{
                  padding: "12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${session.status === "active" ? "var(--warning)" : "var(--text-muted)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{session.session_name}</span>
                    <span
                      className="badge"
                      style={{
                        marginLeft: "8px",
                        padding: "2px 8px",
                        fontSize: "10px",
                        background: session.status === "active" ? "var(--warning)" : "rgba(255,255,255,0.1)",
                        color: session.status === "active" ? "#000" : "var(--text-muted)",
                      }}
                    >
                      {session.status.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {session.start_time} – {session.end_time}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                  📁 {session.group_name} | {session.present_count} present, {session.absent_count} absent of {session.total_members}
                </div>
                {session.absent_members.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {session.absent_members.map((member) => (
                      <button
                        key={member.identity}
                        onClick={() => setSelectedPerson(member.name)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                        }}
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-body">
          <div className="grid-3">
            <div className="stat-card">
              <p className="stat-label">Rows Visible</p>
              <p className="stat-value">{totalRows}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Present</p>
              <p className="stat-value">{presentCount}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Absent</p>
              <p className="stat-value">{absentCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Attendance Report Table</h2>
            <p className="panel-subtitle">Filter, import, and inspect attendance records.</p>
          </div>
        </div>

        <div className="panel-body" style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: "10px" }}>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="field" />
            <input placeholder="Search name" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="field" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
              {["All", "Present", "Half Day", "Absent"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button onClick={() => refetch()} className="btn btn-primary">
              Refresh
            </button>
            <button 
              onClick={handleExportCSV}
              className="btn"
              style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.4)" }}
            >
              Export CSV
            </button>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all attendance logs? This action cannot be undone.")) {
                  clearLogs().then(() => refetch());
                }
              }} 
              className="btn"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}
            >
              Clear All Logs
            </button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {["Date", "Name", "Role", "In Time", "Out Time", "Hours", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7}>Loading attendance records...</td>
                  </tr>
                )}
                {!isLoading && isError && (
                  <tr>
                    <td colSpan={7}>Unable to load report data. Please check backend connection and try refresh.</td>
                  </tr>
                )}
                {!isLoading && !isError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7}>No records found for selected filters.</td>
                  </tr>
                )}
                {!isLoading && !isError && filtered.map((row, i) => (
                  <tr key={`${row.Date}-${row.Name}-${i}`}>
                    <td>{row.Date}</td>
                    <td>
                      <button
                        onClick={() => setSelectedPerson(row.Name)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent)",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          font: "inherit",
                        }}
                      >
                        {row.Name}
                      </button>
                    </td>
                    <td>{row.Role}</td>
                    <td>{row.In_time}</td>
                    <td>{row.Out_time}</td>
                    <td>{row.Duration_hours?.toFixed(1) ?? "-"}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(row.Status)}`}>
                        {row.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Per-Person Drill-Down Modal */}
      {selectedPerson && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedPerson(null)}
        >
          <div
            className="panel"
            style={{ width: "90%", maxWidth: "700px", maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="panel-title">{selectedPerson} - Attendance Records</h2>
                <p className="panel-subtitle">{personRecords.length} record(s) found</p>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>
            <div className="panel-body">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {["Date", "Role", "In Time", "Out Time", "Hours", "Status"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {personRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          No records for this person with current filters.
                        </td>
                      </tr>
                    ) : (
                      personRecords.map((row, i) => (
                        <tr key={`${row.Date}-${i}`}>
                          <td>{row.Date}</td>
                          <td>{row.Role}</td>
                          <td>{row.In_time}</td>
                          <td>{row.Out_time}</td>
                          <td>{row.Duration_hours?.toFixed(1) ?? "-"}</td>
                          <td>
                            <span className={`badge ${statusBadgeClass(row.Status)}`}>
                              {row.Status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "16px", padding: "12px", background: "var(--surface)", borderRadius: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                <p>
                  <strong>Summary:</strong> {personRecords.filter((r) => r.Status === "Present").length} present, {personRecords.filter((r) => r.Status === "Absent").length} absent
                </p>
                <p>
                  <strong>Total Hours:</strong> {personRecords.reduce((sum, r) => sum + (r.Duration_hours ?? 0), 0).toFixed(1)} hours
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
