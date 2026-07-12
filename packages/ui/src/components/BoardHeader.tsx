import React from "react";
import { LivePill } from "./LivePill";

export interface BoardHeaderProps {
  practiceName: string;
  activeCount?: number;
  logoUrl?: string;
  onlyActive?: boolean;
  onToggleOnlyActive?: (value: boolean) => void;
  style?: React.CSSProperties;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({
  practiceName,
  activeCount,
  logoUrl,
  onlyActive = false,
  onToggleOnlyActive,
  style,
}) => {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 6px 14px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        marginBottom: 10,
        fontFamily: "var(--rb-font-body)",
        color: "#e8eefc",
        ...style,
      }}
    >
      {/* Practice identity */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {logoUrl ? (
            <img src={logoUrl} alt={practiceName} style={{ height: 24, width: "auto", objectFit: "contain" }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="7" y="0" width="6" height="20" rx="2" fill="#ef4444" />
              <rect x="0" y="7" width="20" height="6" rx="2" fill="#ef4444" />
            </svg>
          )}
          <span
            style={{
              fontFamily: "var(--rb-font-display)",
              fontWeight: 800,
              fontSize: 15,
              color: "#eef3ff",
              letterSpacing: "-.02em",
              whiteSpace: "nowrap",
            }}
          >
            {practiceName}
          </span>
        </div>
        <span style={{ fontSize: 10.5, color: "#5b6f96", letterSpacing: ".01em", paddingLeft: 25 }}>
          Today
          {activeCount != null && ` · ${activeCount} active`}
        </span>
      </div>

      {/* Only-active toggle */}
      {onToggleOnlyActive && (
        <button
          onClick={() => onToggleOnlyActive(!onlyActive)}
          aria-pressed={onlyActive}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,.05)",
            border: onlyActive ? "1px solid rgba(125,211,252,.42)" : "1px solid rgba(255,255,255,.10)",
            padding: "5px 8px 5px 10px",
            borderRadius: "var(--rb-radius-full)",
            whiteSpace: "nowrap",
            cursor: "pointer",
            boxShadow: onlyActive ? "0 0 0 1px rgba(125,211,252,.16)" : "none",
          }}
        >
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", color: "#8096b8", textTransform: "uppercase" }}>
            Only Active
          </span>
          {/* Mini switch */}
          <span
            style={{
              width: 34,
              height: 20,
              borderRadius: "var(--rb-radius-full)",
              background: onlyActive ? "transparent" : "#1e2d47",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: onlyActive ? 16 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: onlyActive ? "#7dd3fc" : "#7a90b8",
                transition: "left .18s ease, background .18s ease",
              }}
            />
          </span>
        </button>
      )}

      {/* Live indicator */}
      <LivePill state="live" />
    </header>
  );
};
