"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getLogs, getReport, clearLogs } from "@/lib/api";

type ReportRow = {
  Date: string;
  Name: string;
  Role: string;
  In_time: string;
  Out_time: string;
  Duration_hours?: number;
  Status: string;
};

type RawRow = Record<string, unknown>;

function asText(value: unknown, fallback = "-") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseRows(payload: unknown): ReportRow[] {
  const source = (payload ?? {}) as Record<string, unknown>;

  const candidates = [
    source.report,
    source.reports,
    source.logs,
    source.data,
    (source.data as Record<string, unknown> | undefined)?.report,
    (source.data as Record<string, unknown> | undefined)?.logs,
    (source.result as Record<string, unknown> | undefined)?.report,
    (source.result as Record<string, unknown> | undefined)?.logs
  ];

  const list = candidates.find((item) => Array.isArray(item)) as RawRow[] | undefined;
  if (!list) return [];

  return list.map((raw) => {
    const date = asText(raw.Date ?? raw.date ?? raw.day ?? raw.attendance_date);
    const name = asText(raw.Name ?? raw.name ?? raw.person_name ?? raw.identity_name ?? raw.employee_name);
    const role = asText(raw.Role ?? raw.role ?? raw.user_role ?? raw.person_role, "Unknown");
    const inTime = asText(raw.In_time ?? raw.in_time ?? raw.inTime ?? raw.first_in ?? raw.check_in);
    const outTime = asText(raw.Out_time ?? raw.out_time ?? raw.outTime ?? raw.last_out ?? raw.check_out);
    const duration = asNumber(raw.Duration_hours ?? raw.duration_hours ?? raw.duration ?? raw.hours);
    const status = asText(raw.Status ?? raw.status ?? raw.attendance_status, "Absent");

    return {
      Date: date,
      Name: name,
      Role: role,
      In_time: inTime,
      Out_time: outTime,
      Duration_hours: duration,
      Status: status
    };
  });
}

function statusBadgeClass(status: string) {
  if (status === "Present") return "success";
  if (status === "Half Day") return "warning";
  return "error";
}

export default function ReportPage() {
  const [dateFilter, setDateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const { isLoaded, userId } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", userId],
    enabled: !!isLoaded && !!userId,
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
