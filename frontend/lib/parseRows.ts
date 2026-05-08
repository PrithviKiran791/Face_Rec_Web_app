// frontend/lib/parseRows.ts
// Shared utility for parsing attendance report/log payloads from the backend.

export type ReportRow = {
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

export function parseRows(payload: unknown): ReportRow[] {
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

  return list.map((rawObj) => {
    if (typeof rawObj === "string") {
      const parts = rawObj.split("@");
      if (parts.length >= 3) {
        const datetime = parts[2];
        const [d, t] = datetime.split(" ");
        return {
          Date: d || "-",
          Name: parts[0] || "-",
          Role: parts[1] || "Unknown",
          In_time: t || "-",
          Out_time: t || "-",
          Status: "Present",
          Duration_hours: 0
        };
      }
    }

    const raw = rawObj as Record<string, unknown>;
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

export function statusBadgeClass(status: string) {
  if (status === "Present") return "success";
  if (status === "Half Day") return "warning";
  return "danger";
}
