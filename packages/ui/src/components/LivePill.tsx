import React from "react";

export interface LivePillProps {
  /** Show as syncing, error, or healthy */
  state?: "live" | "syncing" | "error" | "idle";
  label?: string;
  style?: React.CSSProperties;
}

const stateColors: Record<string, string> = {
  live:    "#18b06b",
  syncing: "#7dd3fc",
  error:   "#fda4af",
  idle:    "#a9b6d3",
};

export const LivePill: React.FC<LivePillProps> = ({
  state = "live",
  label,
  style,
}) => {
  const color = stateColors[state] ?? stateColors.live;
  const defaultLabel = state === "live" ? "Live" : state === "syncing" ? "Syncing…" : state === "error" ? "Error" : "Idle";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px 1px ${color}99`,
          animation: state === "live" || state === "syncing" ? "rb-pulse 2s ease-in-out infinite" : "none",
          flexShrink: 0,
        }}
      />
      {label ?? defaultLabel}
    </span>
  );
};
