import React from "react";

export type DoctorBadgeShape =
  | "circle"
  | "rounded"
  | "paw"
  | "star"
  | "heart"
  | "shield"
  | "hexagon";

export interface DoctorBadgeProps {
  /** Doctor's display name — used to derive initials and colour */
  name: string;
  /** Custom background colour — auto-derived from name if omitted */
  color?: string;
  /** Text colour on the badge */
  textColor?: string;
  size?: number;
  shape?: DoctorBadgeShape;
  style?: React.CSSProperties;
}

const PALETTE = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#f97316",
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const DoctorBadge: React.FC<DoctorBadgeProps> = ({
  name,
  color,
  textColor = "#fff",
  size = 44,
  shape = "circle",
  style,
}) => {
  const bg = color ?? colorFromName(name);
  const initials = initialsFromName(name);
  const borderRadius = shape === "rounded" ? "var(--rb-radius-sm)" : "50%";

  return (
    <span
      aria-label={name}
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius,
        background: bg,
        border: `1px solid ${bg}cc`,
        color: textColor,
        fontFamily: "var(--rb-font-display)",
        fontWeight: 800,
        fontSize: Math.round(size * 0.32),
        flexShrink: 0,
        userSelect: "none",
        ...style,
      }}
    >
      {initials}
    </span>
  );
};
