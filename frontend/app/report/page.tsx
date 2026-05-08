"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getLogs, getReport, clearLogs } from "@/lib/api";
import { parseRows, statusBadgeClass } from "@/lib/parseRows";
import type { ReportRow } from "@/lib/parseRows";

export default function ReportPage() {
  const [dateFilter, setDateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  const filtered = (data ?? []).filter((row) => {
    if (dateFilter && row.Date !== dateFilter) return false;
    if (nameFilter && !row.Name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (statusFilter !== "All" && row.Status !== statusFilter) return false;
    return true;
  });

  const totalRows = filtered.length;
  const presentCount = filtered.filter((r) => r.Status === "Present").length;
  const absentCount = filtered.filter((r) => r.Status === "Absent").length;

  return (
    <main className="space-y-4">
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: "10px" }}>
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
                    <td>{row.Name}</td>
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
    </main>
  );
}
