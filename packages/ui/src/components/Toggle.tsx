import React from "react";

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled,
  style,
}) => {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--rb-radius)",
        border: "1px solid var(--rb-dark-border, rgba(255,255,255,.10))",
        background: "var(--rb-dark-panel-2, rgba(10,16,30,.70))",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 14,
        color: "var(--rb-dark-text, #e8eefc)",
        userSelect: "none",
        ...style,
      }}
    >
      {label && <span>{label}</span>}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        aria-checked={checked}
      />
      {/* Visual switch track */}
      <span
        style={{
          position: "relative",
          width: 44,
          height: 26,
          borderRadius: "var(--rb-radius-full)",
          border: "1px solid",
          borderColor: checked ? "rgba(45,212,191,.35)" : "rgba(255,255,255,.10)",
          background: checked ? "rgba(45,212,191,.18)" : "rgba(255,255,255,.06)",
          transition: "background var(--rb-transition), border-color var(--rb-transition)",
          flexShrink: 0,
        }}
      >
        {/* Knob */}
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 19 : 1,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: checked ? "rgba(45,212,191,.95)" : "rgba(255,255,255,.85)",
            boxShadow: "0 3px 10px rgba(0,0,0,.2)",
            transition: "left .12s ease, background var(--rb-transition)",
          }}
        />
      </span>
    </label>
  );
};
