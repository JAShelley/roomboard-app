import React from "react";
import { TimerBox, TimerStyle, TimerState } from "./TimerBox";
import { DoctorBadge } from "./DoctorBadge";
import { StatusBadge, RoomStatus } from "./StatusBadge";

export interface RoomCardProps {
  roomName: string;
  patientName?: string;
  visitType?: string;
  doctorName?: string;
  notes?: string;
  elapsedMs?: number;
  timerState?: TimerState;
  timerStyle?: TimerStyle;
  status?: RoomStatus;
  /** True while room is being cleaned between patients */
  cleaning?: boolean;
  /** Room-ready flag set by front desk */
  roomReady?: boolean;
  /** Doctor-ready flag set by provider */
  doctorReady?: boolean;
  onDischarge?: () => void;
  style?: React.CSSProperties;
}

const STATUS_BG: Partial<Record<RoomStatus, string>> = {
  exam:      "linear-gradient(170deg, #4b93f8, #1d6fd4)",
  recheck:   "linear-gradient(170deg, #f8b84e, #d4850b)",
  procedure: "linear-gradient(170deg, #f06080, #c42050)",
  consult:   "linear-gradient(170deg, #a07cf8, #6b3fd4)",
  workin:    "linear-gradient(170deg, #f8c84e, #d4990b)",
  ready:     "linear-gradient(170deg, #30c87c, #0f8a50)",
};

const STATUS_ACCENT: Partial<Record<RoomStatus, string>> = {
  exam:      "#6baaf8",
  recheck:   "#f8c86a",
  procedure: "#f07090",
  consult:   "#b09af8",
  workin:    "#f8d46a",
  ready:     "#50d890",
};

export const RoomCard: React.FC<RoomCardProps> = ({
  roomName,
  patientName,
  visitType,
  doctorName,
  notes,
  elapsedMs = 0,
  timerState = "idle",
  timerStyle = "classic",
  status = "empty",
  cleaning = false,
  roomReady = false,
  doctorReady = false,
  onDischarge,
  style,
}) => {
  const isEmpty = !patientName && !cleaning;
  const bg = cleaning
    ? "linear-gradient(170deg, #20242c, #15171c)"
    : isEmpty
    ? "linear-gradient(170deg, #2a3346, #1b2436)"
    : (STATUS_BG[status] ?? "linear-gradient(170deg, rgba(255,255,255,.08), rgba(255,255,255,.03))");

  const accentColor = cleaning
    ? "rgba(245,181,10,.5)"
    : isEmpty
    ? "rgba(255,255,255,.08)"
    : (STATUS_ACCENT[status] ?? "rgba(255,255,255,.18)");

  const textColor = cleaning ? "#e7c98b" : isEmpty ? "#c4d0e4" : "#12233b";

  return (
    <article
      style={{
        position: "relative",
        borderRadius: "var(--rb-radius-md, 18px)",
        border: `2px solid transparent`,
        borderTop: `3px solid ${accentColor}`,
        background: bg,
        boxShadow: "0 10px 24px rgba(0,0,0,.30)",
        color: textColor,
        minHeight: 200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--rb-font-body)",
        ...style,
      }}
    >
      {/* Top strip — room name + status icons */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 16px",
          background: "linear-gradient(180deg, rgba(255,255,255,.14), rgba(0,0,0,.10))",
          borderBottom: `1px solid ${accentColor}44`,
        }}
      >
        <span
          style={{
            fontFamily: "var(--rb-font-display)",
            fontWeight: 700,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {roomName}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {roomReady && (
            <span title="Room ready" style={{ fontSize: 12, opacity: 0.8 }}>✓R</span>
          )}
          {doctorReady && (
            <span title="Doctor ready" style={{ fontSize: 12, opacity: 0.8 }}>✓D</span>
          )}
          {status !== "empty" && !cleaning && (
            <StatusBadge status={status} style={{ fontSize: 10 }} />
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {cleaning ? (
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: ".04em", textTransform: "uppercase", color: "#f3c969", opacity: 0.85 }}>
            🧹 Cleaning
          </span>
        ) : patientName ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.32, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {patientName}
              {visitType && (
                <span style={{ opacity: 0.6, padding: "0 4px" }}>·</span>
              )}
              {visitType && (
                <span style={{ fontWeight: 600, fontSize: 14, opacity: 0.85 }}>{visitType}</span>
              )}
            </div>
            {notes && (
              <div style={{ fontSize: 12, color: "#7dd3fc", fontStyle: "italic", marginTop: 4, opacity: 0.9 }}>
                {notes}
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontWeight: 600, opacity: 0.5, fontSize: 13 }}>Empty</span>
        )}
      </div>

      {/* Footer — timer + doctor badge */}
      <footer
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 16px 14px",
        }}
      >
        <TimerBox
          elapsedMs={elapsedMs}
          state={cleaning ? "cleaning" : timerState}
          timerStyle={timerStyle}
        />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {doctorName && <DoctorBadge name={doctorName} size={40} />}
          {patientName && onDischarge && (
            <button
              onClick={onDischarge}
              style={{
                fontFamily: "var(--rb-font-display)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".02em",
                cursor: "pointer",
                color: "inherit",
                background: "rgba(255,255,255,.16)",
                border: "1px solid rgba(255,255,255,.24)",
                borderRadius: 8,
                padding: "6px 9px",
                lineHeight: 1,
                transition: "background var(--rb-transition)",
              }}
            >
              Discharge
            </button>
          )}
        </div>
      </footer>
    </article>
  );
};
