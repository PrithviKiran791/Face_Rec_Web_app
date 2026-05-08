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

  // JSON Export
  const handleExportJSON = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const reportData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalRecords: filtered.length,
        presentCount: presentCount,
        absentCount: absentCount,
        halfDayCount: filtered.filter((r) => r.Status === "Half Day").length,
      },
      filters: {
        dateFilter,
        nameFilter,
        statusFilter,
      },
      records: filtered,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance-report-${new Date().toISOString().split("T")[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF-Ready HTML Export
  const handleExportPDF = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Report Analysis</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #0ea5e9; border-bottom: 3px solid #0ea5e9; padding-bottom: 10px; }
    h2 { color: #0f172a; margin-top: 24px; }
    .summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat { padding: 15px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .stat-value { font-size: 24px; font-weight: 700; color: #0ea5e9; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #0f172a; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Attendance Report Analysis</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    
    <h2>Summary Statistics</h2>
    <div class="summary">
      <div class="stat">
        <div class="stat-label">Total Records</div>
        <div class="stat-value">${filtered.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Present</div>
        <div class="stat-value" style="color: #22c55e;">${presentCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Absent</div>
        <div class="stat-value" style="color: #ef4444;">${absentCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Attendance Rate</div>
        <div class="stat-value">${filtered.length > 0 ? ((presentCount / filtered.length) * 100).toFixed(1) : 0}%</div>
      </div>
    </div>

    <h2>Applied Filters</h2>
    <ul>
      <li>Date: ${dateFilter || "All dates"}</li>
      <li>Name: ${nameFilter || "All names"}</li>
      <li>Status: ${statusFilter}</li>
    </ul>

    <h2>Attendance Details</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Name</th>
          <th>Role</th>
          <th>In Time</th>
          <th>Out Time</th>
          <th>Hours</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (row) => `
        <tr>
          <td>${row.Date}</td>
          <td>${row.Name}</td>
          <td>${row.Role}</td>
          <td>${row.In_time}</td>
          <td>${row.Out_time}</td>
          <td>${row.Duration_hours?.toFixed(1) ?? "-"}</td>
          <td>
            <span class="badge ${
              row.Status === "Present"
                ? "badge-success"
                : row.Status === "Absent"
                ? "badge-danger"
                : "badge-warning"
            }">
              ${row.Status}
            </span>
          </td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="footer">
      <p>This report was automatically generated by the Face Attendance System.</p>
      <p>For questions or issues, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance-report-${new Date().toISOString().split("T")[0]}.html`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Raw Logs
  const handleDownloadRawLogs = () => {
    if (!data || data.length === 0) {
      alert("No logs available");
      return;
    }

    const logsText = data
      .map(
        (row) =>
          `${row.Date} | ${row.Name} (${row.Role}) | In: ${row.In_time} | Out: ${row.Out_time} | Hours: ${row.Duration_hours?.toFixed(1) ?? "-"} | Status: ${row.Status}`
      )
      .join("\n");

    const blob = new Blob([logsText], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance-logs-${new Date().toISOString().split("T")[0]}.txt`);
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
            <h2 className="panel-title">Download Report</h2>
            <p className="panel-subtitle">Export your attendance data in various formats.</p>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
            <div>
              <label className="field-label" style={{ marginBottom: "6px" }}>Report Formats</label>
              <button 
                onClick={handleExportCSV}
                className="btn"
                style={{ width: "100%", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.4)" }}
              >
                📊 CSV Format
              </button>
            </div>
            <div>
              <label className="field-label" style={{ marginBottom: "6px" }}>&nbsp;</label>
              <button 
                onClick={handleExportJSON}
                className="btn"
                style={{ width: "100%", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.4)" }}
              >
                📋 JSON Format
              </button>
            </div>
            <div>
              <label className="field-label" style={{ marginBottom: "6px" }}>&nbsp;</label>
              <button 
                onClick={handleExportPDF}
                className="btn"
                style={{ width: "100%", backgroundColor: "rgba(249, 115, 22, 0.2)", color: "#f97316", border: "1px solid rgba(249, 115, 22, 0.4)" }}
              >
                📄 PDF Report
              </button>
            </div>
            <div>
              <label className="field-label" style={{ marginBottom: "6px" }}>&nbsp;</label>
              <button 
                onClick={handleDownloadRawLogs}
                className="btn"
                style={{ width: "100%", backgroundColor: "rgba(139, 92, 246, 0.2)", color: "#8b5cf6", border: "1px solid rgba(139, 92, 246, 0.4)" }}
              >
                📝 Raw Logs
              </button>
            </div>
            <button onClick={() => refetch()} className="btn btn-primary">
              Refresh
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
            💡 CSV and JSON formats respect your current filters. PDF and Raw Logs download all available data.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Attendance Report Table</h2>
            <p className="panel-subtitle">Filter and inspect attendance records in detail.</p>
          </div>
        </div>

        <div className="panel-body" style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "10px" }}>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="field" placeholder="Filter by date" />
            <input placeholder="Search name" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="field" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
              {["All", "Present", "Half Day", "Absent"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all attendance logs? This action cannot be undone.")) {
                  clearLogs().then(() => refetch());
                }
              }} 
              className="btn"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}
            >
              Clear All
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
