"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  getSessionAttendance,
  getGroups,
} from "@/lib/api";
import type { SessionPayload } from "@/lib/api";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Session = {
  id: string;
  name: string;
  group_id: string;
  group_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  created_at: string;
};

type Group = { id: string; name: string; description: string; member_count: number };

type AttendanceEntry = { identity: string; name: string; arrival_time?: string };

type AttendanceData = {
  session: Session;
  date: string;
  present: AttendanceEntry[];
  late: AttendanceEntry[];
  absent: AttendanceEntry[];
  total_members: number;
  not_scheduled?: boolean;
};

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

/* ── Icons ────────────────────────────────────────────────────────────────── */
const Icons = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  xCircle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
};

/* ── Helper: session status ───────────────────────────────────────────────── */
function getSessionStatus(s: Session): "active" | "upcoming" | "completed" {
  const now = new Date();
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (nowMin < startMin) return "upcoming";
  if (nowMin > endMin) return "completed";
  return "active";
}

function statusColor(st: string) {
  if (st === "active") return "var(--success)";
  if (st === "upcoming") return "var(--warning)";
  return "var(--text-muted)";
}

export default function SessionsPage() {
  const { isLoaded, userId } = useAuth();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [viewingSession, setViewingSession] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Form state
  const [fName, setFName] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fDays, setFDays] = useState<Set<string>>(new Set(["mon", "tue", "wed", "thu", "fri"]));
  const [fStart, setFStart] = useState("09:00");
  const [fEnd, setFEnd] = useState("10:00");
  const [fLate, setFLate] = useState(15);

  // Queries
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["sessions"],
    enabled: !!isLoaded && !!userId,
    queryFn: async () => (await getSessions()).data.sessions as Session[],
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    enabled: !!isLoaded && !!userId,
    queryFn: async () => (await getGroups()).data.groups as Group[],
  });

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["session-attendance", viewingSession, attendanceDate],
    enabled: !!viewingSession,
    queryFn: async () => (await getSessionAttendance(viewingSession!, attendanceDate)).data as AttendanceData,
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: (d: SessionPayload) => createSession(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.detail || err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: SessionPayload & { id: string }) => updateSession(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.detail || err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  // Handlers
  const closeModal = () => { setShowModal(false); setEditingSession(null); };

  const openCreate = () => {
    setEditingSession(null);
    setFName(""); setFGroup(groupsData?.[0]?.id ?? "");
    setFDays(new Set(["mon", "tue", "wed", "thu", "fri"]));
    setFStart("09:00"); setFEnd("10:00"); setFLate(15);
    setShowModal(true);
  };

  const openEdit = (s: Session) => {
    setEditingSession(s);
    setFName(s.name); setFGroup(s.group_id);
    setFDays(new Set(s.day_of_week === "*" ? DAYS.map(d => d.key) : s.day_of_week.split(",").map(d => d.trim())));
    setFStart(s.start_time); setFEnd(s.end_time);
    setFLate(s.late_threshold_minutes);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!fName.trim() || !fGroup) return;
    const payload: SessionPayload = {
      name: fName.trim(),
      group_id: fGroup,
      day_of_week: fDays.size === 7 ? "*" : Array.from(fDays).join(","),
      start_time: fStart,
      end_time: fEnd,
      late_threshold_minutes: fLate,
    };
    if (editingSession) {
      updateMut.mutate({ id: editingSession.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const toggleDay = (d: string) => {
    const next = new Set(fDays);
    if (next.has(d)) next.delete(d); else next.add(d);
    setFDays(next);
  };

  const sessions = sessionsData ?? [];
  const groups = groupsData ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Scheduled Sessions / Periods</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            Define class periods with time windows, groups, and late thresholds.
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={groups.length === 0}>
          {Icons.plus} New Session
        </button>
      </div>

      {groups.length === 0 && (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: "40px", color: "var(--warning)" }}>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>⚠️ Create at least one group before adding sessions.</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Sessions must be linked to a group.</p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {isLoading ? (
        <div className="panel"><div className="panel-body" style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Loading sessions...</div></div>
      ) : sessions.length === 0 && groups.length > 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>No sessions scheduled</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
              Create scheduled class periods to start tracking per-session attendance.
            </p>
            <button className="btn btn-primary" onClick={openCreate}>{Icons.plus} Create First Session</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sessions.map((s) => {
            const status = getSessionStatus(s);
            const isViewing = viewingSession === s.id;
            return (
              <div key={s.id} className="panel session-card" style={{ borderLeft: `4px solid ${statusColor(status)}` }}>
                <div
                  className="panel-header"
                  style={{ cursor: "pointer" }}
                  onClick={() => { setViewingSession(isViewing ? null : s.id); setAttendanceDate(new Date().toISOString().split("T")[0]); }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)" }}>{s.name}</span>
                        <span className={`badge ${status === "active" ? "success" : status === "upcoming" ? "warning" : ""}`} style={{ fontSize: "9px" }}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>{Icons.clock} {s.start_time} – {s.end_time}</span>
                        <span>📁 {s.group_name}</span>
                        <span>⏱ Late after {s.late_threshold_minutes}min</span>
                        <span style={{ display: "flex", gap: "4px" }}>
                          {(s.day_of_week === "*" ? DAYS.map(d => d.key) : s.day_of_week.split(",")).map((d) => (
                            <span key={d} className="day-chip active">{d.trim().slice(0, 2).toUpperCase()}</span>
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(s); }} title="Edit">{Icons.edit}</button>
                    <button className="icon-btn icon-btn-danger" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete session "${s.name}"?`)) deleteMut.mutate(s.id); }} title="Delete">{Icons.trash}</button>
                  </div>
                </div>

                {/* Expanded: Attendance detail */}
                {isViewing && (
                  <div className="panel-body" style={{ borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600 }}>Attendance Breakdown</span>
                      <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="field" style={{ width: "auto", padding: "8px 12px", fontSize: "13px" }} />
                    </div>

                    {attendanceLoading ? (
                      <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading attendance...</p>
                    ) : !attendanceData ? (
                      <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No data available.</p>
                    ) : attendanceData.not_scheduled ? (
                      <p style={{ color: "var(--warning)", fontSize: "13px" }}>This session is not scheduled on the selected date.</p>
                    ) : (
                      <div>
                        {/* Summary bar */}
                        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                          <div className="attendance-stat" style={{ borderColor: "var(--success)" }}>
                            <span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>{Icons.check} Present</span>
                            <strong>{attendanceData.present.length}</strong>
                          </div>
                          <div className="attendance-stat" style={{ borderColor: "var(--warning)" }}>
                            <span style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: "4px" }}>{Icons.alert} Late</span>
                            <strong>{attendanceData.late.length}</strong>
                          </div>
                          <div className="attendance-stat" style={{ borderColor: "var(--danger)" }}>
                            <span style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: "4px" }}>{Icons.xCircle} Absent</span>
                            <strong>{attendanceData.absent.length}</strong>
                          </div>
                          <div className="attendance-stat" style={{ borderColor: "var(--text-muted)" }}>
                            <span style={{ color: "var(--text-muted)" }}>Total</span>
                            <strong>{attendanceData.total_members}</strong>
                          </div>
                        </div>

                        {/* Lists */}
                        <div className="dash-grid-3" style={{ gap: "12px" }}>
                          <AttendanceList title="Present" items={attendanceData.present} color="var(--success)" showTime />
                          <AttendanceList title="Late" items={attendanceData.late} color="var(--warning)" showTime />
                          <AttendanceList title="Absent" items={attendanceData.absent} color="var(--danger)" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>{editingSession ? "Edit Session" : "Create New Session"}</h3>
              <button className="icon-btn" onClick={closeModal}>{Icons.x}</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label className="field-label">Session Name *</label>
                  <input className="field" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Math Period 1, Morning Lecture" autoFocus />
                </div>
                <div>
                  <label className="field-label">Linked Group *</label>
                  <select className="field" value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={{ width: "100%" }}>
                    <option value="">Select a group...</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Days of Week</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {DAYS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`day-chip ${fDays.has(d.key) ? "active" : ""}`}
                        onClick={() => toggleDay(d.key)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="field-label">Start Time</label>
                    <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} className="field" />
                  </div>
                  <div>
                    <label className="field-label">End Time</label>
                    <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Late After (min)</label>
                    <input type="number" value={fLate} min={0} max={120} onChange={(e) => setFLate(Number(e.target.value))} className="field" />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "transparent" }} onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!fName.trim() || !fGroup}>{editingSession ? "Save Changes" : "Create Session"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Attendance List Sub-component ────────────────────────────────────────── */
function AttendanceList({ title, items, color, showTime }: {
  title: string; items: AttendanceEntry[]; color: string; showTime?: boolean;
}) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color }}>{items.length}</span>
      </div>
      <div style={{ maxHeight: "200px", overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>None</div>
        ) : (
          items.map((item, i) => (
            <div key={item.identity + i} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
              <span style={{ fontWeight: 500 }}>{item.name}</span>
              {showTime && item.arrival_time && <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{item.arrival_time}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
