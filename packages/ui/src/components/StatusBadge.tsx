import React from "react";

export type RoomStatus =
  | "exam"
  | "recheck"
  | "procedure"
  | "consult"
  | "workin"
  | "ready"
  | "cleaning"
  | "empty";

export interface StatusBadgeProps {
  status: RoomStatus;
  label?: string;
  style?: React.CSSProperties;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  exam:      "var(--rb-status-exam, #3b82f6)",
  recheck:   "var(--rb-status-recheck, #f59e0b)",
  procedure: "var(--rb-status-procedure, #ef476f)",
  consult:   "var(--rb-status-consult, #8b5cf6)",
  workin:    "var(--rb-status-workin, #f59e0b)",
  ready:     "var(--rb-status-ready, #18b06b)",
  cleaning:  "var(--rb-status-cleaning, #fbbf24)",
  empty:     "rgba(255,255,255,.12)",
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  exam:      "Exam",
  recheck:   "Recheck",
  procedure: "Procedure",
  consult:   "Consult",
  workin:    "Walk-in",
  ready:     "Ready",
  cleaning:  "Cleaning",
  empty:     "Empty",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, style }) => {
  const color = STATUS_COLORS[status];
  const text = label ?? STATUS_LABELS[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--rb-radius-full)",
        background: `${color}22`,
        border: `1px solid ${color}55`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        color: status === "empty" ? "rgba(255,255,255,.4)" : "#fff",
        ...style,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {text}
    </span>
  );
};
