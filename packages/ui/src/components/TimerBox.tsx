import React from "react";

export type TimerStyle =
  | "classic"
  | "minimal"
  | "glass"
  | "scoreboard"
  | "pill"
  | "neon"
  | "paper"
  | "embossed";

export type TimerState = "idle" | "running" | "alert1" | "alert2" | "cleaning";

export interface TimerBoxProps {
  /** Elapsed milliseconds */
  elapsedMs: number;
  state?: TimerState;
  timerStyle?: TimerStyle;
  alert1Color?: string;
  alert2Color?: string;
  /** Optional label rendered above the time (e.g. "Room time") */
  label?: string;
  style?: React.CSSProperties;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const boxStyles: Record<TimerStyle, React.CSSProperties> = {
  classic: {
    padding: "10px 14px",
    borderRadius: "var(--rb-radius)",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(10,16,30,.70)",
  },
  minimal: {
    padding: "2px 0",
    border: 0,
    borderRadius: 0,
    background: "transparent",
  },
  glass: {
    padding: "12px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.32)",
    background: "linear-gradient(155deg, rgba(255,255,255,.24), rgba(255,255,255,.05))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.38), 0 20px 42px rgba(0,0,0,.30)",
    backdropFilter: "blur(18px) saturate(150%)",
  },
  scoreboard: {
    padding: "13px 16px",
    borderRadius: 10,
    border: "2px solid #05080f",
    background: "linear-gradient(180deg, #060a13, #0a0f1c)",
    boxShadow: "inset 0 2px 7px rgba(0,0,0,.85), 0 6px 18px rgba(0,0,0,.45)",
  },
  pill: {
    padding: "7px 20px",
    borderRadius: "var(--rb-radius-full)",
    border: "1px solid rgba(129,140,248,.6)",
    background: "linear-gradient(135deg, rgba(99,102,241,.96), rgba(168,85,247,.94))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 10px 24px rgba(99,102,241,.38)",
  },
  neon: {
    padding: "10px 16px",
    borderRadius: "var(--rb-radius)",
    border: "1.5px solid rgba(56,189,248,.9)",
    background: "rgba(7,11,22,.55)",
    boxShadow: "0 0 12px rgba(56,189,248,.55), inset 0 0 14px rgba(56,189,248,.22)",
  },
  paper: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px dashed rgba(120,90,40,.5)",
    background: "linear-gradient(180deg, #fbf6ea, #f0e6cd)",
    boxShadow: "inset 0 0 0 4px rgba(255,255,255,.45), 0 8px 18px rgba(0,0,0,.30)",
  },
  embossed: {
    padding: "12px 16px",
    borderRadius: "var(--rb-radius)",
    border: "1px solid rgba(0,0,0,.5)",
    background: "linear-gradient(180deg, #2b303b, #191c25)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 -2px 6px rgba(0,0,0,.5), 0 8px 18px rgba(0,0,0,.35)",
  },
};

const timeStyles: Record<TimerStyle, React.CSSProperties> = {
  classic:    { color: "var(--rb-dark-text, #e8eefc)" },
  minimal:    { fontWeight: 300, letterSpacing: "2.5px", fontSize: "calc(var(--rb-text-xl) + 7px)" },
  glass:      { color: "var(--rb-dark-text)", letterSpacing: 1 },
  scoreboard: { color: "#39ff8c", fontWeight: 700, letterSpacing: 3, textShadow: "0 0 4px rgba(57,255,140,.9), 0 0 16px rgba(57,255,140,.45)" },
  pill:       { color: "#fff", fontWeight: 700, letterSpacing: ".6px" },
  neon:       { color: "#e3f7ff", letterSpacing: 2, textShadow: "0 0 6px rgba(56,189,248,.95), 0 0 16px rgba(56,189,248,.6)" },
  paper:      { color: "#3a2c14", letterSpacing: "1.5px", textShadow: "none" },
  embossed:   { color: "#9aa3b2", letterSpacing: 1, textShadow: "0 -1px 1px rgba(0,0,0,.75), 0 1px 0 rgba(255,255,255,.14)" },
};

export const TimerBox: React.FC<TimerBoxProps> = ({
  elapsedMs,
  state = "idle",
  timerStyle = "classic",
  alert1Color = "var(--rb-timer-alert-1, #fbbf24)",
  alert2Color = "var(--rb-timer-alert-2, #fb7185)",
  label,
  style,
}) => {
  const box = boxStyles[timerStyle];
  const timeBase = timeStyles[timerStyle];

  let timeColor = timeBase.color as string | undefined;
  if (state === "alert1") timeColor = alert1Color;
  if (state === "alert2") timeColor = alert2Color;
  if (state === "cleaning") timeColor = "#e7c98b";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        ...box,
        ...style,
      }}
    >
      {label && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.6, color: "inherit" }}>
          {label}
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--rb-font-mono)",
          fontWeight: 700,
          fontSize: "var(--rb-text-xl, 18px)",
          letterSpacing: ".6px",
          fontVariantNumeric: "tabular-nums",
          ...timeBase,
          color: timeColor,
        }}
      >
        {formatTime(elapsedMs)}
      </span>
    </div>
  );
};
