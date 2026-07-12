import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "warn" | "danger";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
  children: React.ReactNode;
}

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  fontFamily: "var(--rb-font-body)",
  fontWeight: 600,
  lineHeight: 1,
  border: "1px solid transparent",
  borderRadius: "var(--rb-radius)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "transform var(--rb-transition), box-shadow var(--rb-transition), background var(--rb-transition), border-color var(--rb-transition)",
  userSelect: "none",
};

const sizes = {
  sm:  { padding: "9px 11px",  fontSize: 13 },
  md:  { padding: "13px 20px", fontSize: 15 },
  lg:  { padding: "16px 26px", fontSize: 16, borderRadius: "var(--rb-radius-md)" },
};

const variants: Record<string, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--rb-teal-500), var(--rb-teal-600))",
    color: "#fff",
    borderColor: "transparent",
    boxShadow: "0 10px 24px rgba(2,132,199,.35)",
  },
  ghost: {
    background: "var(--rb-surface, #fff)",
    color: "var(--rb-ink, #0f1b2d)",
    borderColor: "var(--rb-line-strong, #d3deea)",
    boxShadow: "var(--rb-shadow-sm)",
  },
  warn: {
    background: "rgba(255,255,255,.05)",
    color: "var(--rb-dark-text, #e8eefc)",
    borderColor: "rgba(251,191,36,.45)",
    boxShadow: "var(--rb-shadow-dark-sm)",
  },
  danger: {
    background: "rgba(255,255,255,.05)",
    color: "var(--rb-dark-text, #e8eefc)",
    borderColor: "rgba(251,113,133,.45)",
    boxShadow: "var(--rb-shadow-dark-sm)",
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", busy, children, style, disabled, ...props }, ref) => {
    const sizeStyle = sizes[size];
    const variantStyle = variants[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        style={{
          ...base,
          ...sizeStyle,
          ...variantStyle,
          ...(busy || disabled ? { opacity: 0.72, cursor: "wait", transform: "none", boxShadow: "none" } : {}),
          ...style,
        }}
        {...props}
      >
        {children}
        {busy && (
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid currentColor",
              borderRightColor: "transparent",
              animation: "rb-spin .75s linear infinite",
              flexShrink: 0,
            }}
          />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
